import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Bell, BotMessageSquare, Camera, ChevronRight, Flame, Home, Search, User as UserIcon } from "lucide-react";
import zentraLogo from "../../assets/images/icon.jpg";
import type { AppScreen, MetricPickerState, Profile, Tab } from "@/app/types";
import { formatHeightValue, formatWeightValue } from "@/app/utils";
export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button className="primary-button" type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
  onLogo,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
  onLogo?: () => void;
}) {
  return (
    <header className="screen-header">
      {onBack ? (
        <button className="icon-button" onClick={onBack} aria-label="Back">
          <ChevronRight className="rotate-180" size={22} />
        </button>
      ) : (
        <span className="header-spacer" />
      )}
      <div>
        <h1>{onLogo ? <button className="title-logo-button" onClick={onLogo}><img src={zentraLogo} alt="" />{title}</button> : title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action ?? <span className="header-spacer" />}
    </header>
  );
}

export function TabBar({ screen, navigate }: { screen: AppScreen; navigate: (screen: AppScreen) => void }) {
  const items: { id: Tab; label: string; screen: AppScreen; icon: typeof Home; mobile?: boolean }[] = [
    { id: "home", label: "Home", screen: "home", icon: Home, mobile: true },
    { id: "home", label: "Form", screen: "formCorrection", icon: Camera, mobile: true },
    { id: "ai", label: "Zentra AI", screen: "ai", icon: BotMessageSquare, mobile: true },
    { id: "logs", label: "Logs", screen: "logs", icon: BarChart3, mobile: true },
    { id: "profile", label: "Profile", screen: "profile", icon: UserIcon, mobile: true },
  ];

  return (
    <nav className="bottom-tabs" aria-label="Main tabs">
      {items.map((item) => {
        const Icon = item.icon;
        const isAi = item.id === "ai";
        const isActive =
          screen === item.screen ||
          (item.screen === "formCorrection" && (screen === "formExercises" || screen === "formLive"));
        return (
          <button
            className={`tab-button ${isActive ? "tab-active" : ""} ${isAi ? "ai-tab" : ""} ${item.mobile ? "mobile-tab" : "desktop-only-tab"}`}
            key={item.id}
            onClick={() => navigate(item.screen)}
            type="button"
          >
            <span className={isAi ? "ai-tab-icon" : ""}>
              <Icon size={isAi ? 28 : 22} />
            </span>
            {item.label && <small>{item.label}</small>}
          </button>
        );
      })}
    </nav>
  );
}

export function MetricPickerModal({
  picker,
  onClose,
  showToast,
}: {
  picker: NonNullable<MetricPickerState>;
  onClose: () => void;
  showToast: (message: string) => void;
}) {
  const [value, setValue] = useState(picker.value);
  const [unit, setUnit] = useState(picker.unit);
  const options = useMemo(
    () => Array.from({ length: picker.metric === "height" ? 101 : 186 }, (_, index) => (picker.metric === "height" ? 120 : 35) + index),
    [picker.metric],
  );
  const format = picker.metric === "height" ? formatHeightValue : formatWeightValue;
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const rowHeight = 72;

  useEffect(() => {
    const index = Math.max(0, options.indexOf(value));
    wheelRef.current?.scrollTo({ top: index * rowHeight, behavior: "auto" });
  }, [options, value]);

  const handleWheelScroll = () => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const nextIndex = Math.min(options.length - 1, Math.max(0, Math.round(wheel.scrollTop / rowHeight)));
    const nextValue = options[nextIndex];
    if (nextValue !== value) setValue(nextValue);
  };

  const selectWheelValue = (item: number) => {
    setValue(item);
    const index = Math.max(0, options.indexOf(item));
    wheelRef.current?.scrollTo({ top: index * rowHeight, behavior: "smooth" });
  };

  const complete = async () => {
    try {
      await picker.onSave(value, unit);
      onClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update metric.");
    }
  };

  return (
    <div className="metric-modal-backdrop">
      <section className="metric-modal">
        <button className="icon-button metric-modal-back" onClick={onClose} aria-label="Back">
          <ChevronRight className="rotate-180" size={26} />
        </button>
        <h1>{picker.metric === "height" ? "What's your height?" : "Almost there!"}</h1>
        <div className="metric-modal-card">
          <h2>{picker.metric === "height" ? "Your Height" : "Your Weight"}</h2>
          <div className="segmented compact metric-unit-tabs">
            {(picker.metric === "height" ? ["cm", "ft-in"] : ["kg", "lb"]).map((item) => (
              <button className={unit === item ? "segment-active" : ""} onClick={() => setUnit(item)} key={item}>
                {item}
              </button>
            ))}
          </div>
          <div className="metric-wheel" ref={wheelRef} onScroll={handleWheelScroll}>
            <div className="metric-wheel-spacer" />
            {options.map((item) => (
              <button className={item === value ? "metric-wheel-row selected" : "metric-wheel-row"} key={item} onClick={() => selectWheelValue(item)} type="button">
                {format(item, unit)}
              </button>
            ))}
            <div className="metric-wheel-spacer" />
          </div>
        </div>
        <PrimaryButton onClick={complete}>Done</PrimaryButton>
      </section>
    </div>
  );
}

export function AppTopBar({ profile, navigate }: { profile: Profile | null; navigate: (screen: AppScreen) => void }) {
  const initials = `${profile?.first_name?.[0] ?? "A"}${profile?.last_name?.[0] ?? "Z"}`;
  return (
    <header className="top-bar">
      <label className="search-box">
        <Search size={18} />
        <input placeholder="Search workouts, meals, articles..." />
      </label>
      <div className="top-actions">
        <button className="icon-button" aria-label="Notifications"><Bell size={20} /></button>
        <button className="top-avatar" onClick={() => navigate("profile")}>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials}
        </button>
      </div>
    </header>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return <div className="empty-state"><strong>{title}</strong>{body && <p>{body}</p>}</div>;
}








export function Stat({ icon: Icon, value, label }: { icon: typeof Flame; value: React.ReactNode; label: string }) {
  return <div className="stat-card"><Icon size={20} /><strong>{value}</strong><small>{label}</small></div>;
}
