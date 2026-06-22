"""
In-memory conversation store for the RAG chat.

Design constraints:
- Strictly bounded so cost-per-query stays tiny:
    * Only the last MAX_TURNS user+assistant pairs are remembered.
    * Each stored message is truncated to MAX_MSG_CHARS characters.
- Per-conversation entries expire after TTL_SECONDS of inactivity so a
  long-running process doesn't accumulate dead conversations.
- Thread-safe (FastAPI may run handlers in a threadpool).
"""

from collections import deque
from threading import Lock
from time import time
from typing import Deque, Dict, List, Tuple

# Tunables — keep these small. The whole point is bounded context.
MAX_TURNS = 3                 # ≤ 6 stored messages per conversation
MAX_MSG_CHARS = 240           # truncate each message on the way in
TTL_SECONDS = 60 * 60         # 1 hour idle → conversation evicted


Message = Dict[str, str]      # {"role": "user"|"assistant", "content": str}


class ConversationMemory:
    def __init__(self) -> None:
        # conv_id -> (deque[Message], last_touched_epoch_seconds)
        self._store: Dict[str, Tuple[Deque[Message], float]] = {}
        self._lock = Lock()

    # ---- internal helpers --------------------------------------------------

    def _gc_locked(self) -> None:
        """Drop conversations whose last touch is older than TTL."""
        now = time()
        stale = [cid for cid, (_, ts) in self._store.items() if now - ts > TTL_SECONDS]
        for cid in stale:
            self._store.pop(cid, None)

    # ---- public API --------------------------------------------------------

    def get(self, conv_id: str) -> List[Message]:
        if not conv_id:
            return []
        with self._lock:
            self._gc_locked()
            entry = self._store.get(conv_id)
            if not entry:
                return []
            messages, _ = entry
            # Refresh the touch timestamp on read; counts as activity.
            self._store[conv_id] = (messages, time())
            return list(messages)

    def append(self, conv_id: str, role: str, content: str) -> None:
        if not conv_id or not content:
            return
        clipped = content[:MAX_MSG_CHARS].strip()
        if not clipped:
            return
        with self._lock:
            self._gc_locked()
            entry = self._store.get(conv_id)
            if entry is None:
                # deque size = turns * 2 (user + assistant per turn)
                messages: Deque[Message] = deque(maxlen=MAX_TURNS * 2)
            else:
                messages = entry[0]
            messages.append({"role": role, "content": clipped})
            self._store[conv_id] = (messages, time())

    def clear(self, conv_id: str) -> bool:
        if not conv_id:
            return False
        with self._lock:
            return self._store.pop(conv_id, None) is not None

    def size(self) -> int:
        with self._lock:
            return len(self._store)


_memory = ConversationMemory()


def get_memory() -> ConversationMemory:
    return _memory
