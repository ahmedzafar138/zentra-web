# Zentra Model Gateway

FastAPI service for live form-correction model inference.

## Bicep Curl Service

The bicep curl endpoint uses the same model artifacts as `Bicep_Curl_Done/infer.py`:

- `Bicep_Curl_Done/Try_2.keras`
- `Bicep_Curl_Done/reps2.pkl`

The model is loaded once during FastAPI startup and reused across inference requests.

## Run

```powershell
cd model_gateway
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8010
```

For local debugging, start the API without loading TensorFlow immediately:

```powershell
$env:MODEL_GATEWAY_LOAD_MODELS_ON_STARTUP="false"
uvicorn app.main:app --host 0.0.0.0 --port 8010
```

Then trigger model loading separately:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8010/api/v1/bicep-curl/load
```

## CPU Runtime Notes

This service is intended to run on CPU. On native Windows, `tensorflow` installs the CPU runtime. If startup fails while loading `_pywrap_tensorflow_internal.pyd`, first install or repair the Microsoft Visual C++ Redistributable 2015-2022 x64, restart the terminal, and run:

```powershell
python -c "import tensorflow as tf; print(tf.__version__); print(tf.config.list_physical_devices('GPU'))"
```

`[]` for GPU devices means TensorFlow is running CPU-only.

## Endpoints

- `GET /health`
- `GET /api/v1/bicep-curl/health`
- `POST /api/v1/bicep-curl/load`
- `POST /api/v1/bicep-curl/session/start`
- `POST /api/v1/bicep-curl/session/{session_id}/frame`
- `POST /api/v1/bicep-curl/session/{session_id}/reset`
- `DELETE /api/v1/bicep-curl/session/{session_id}`
- `POST /api/v1/bicep-curl/predict-rep`

## Frame Shape

`/session/{session_id}/frame` expects the eight selected landmarks from `infer.py`, in this order:

1. right hip
2. left hip
3. right shoulder
4. left shoulder
5. right elbow
6. left elbow
7. right wrist
8. left wrist

Each landmark must be `[x, y, z, visibility]`. A flat 32-number frame is also accepted.

Example payload:

```json
{
  "landmarks": [
    [0, 0, 0, 1],
    [0, 0, 0, 1],
    [0.3, 0.4, 0, 1],
    [0, 0, 0, 1],
    [0.4, 0.5, 0, 1],
    [0, 0, 0, 1],
    [0.5, 0.7, 0, 1],
    [0, 0, 0, 1]
  ]
}
```

For the React Native app, the efficient path is to extract pose landmarks on-device and send only these landmark values to the gateway at camera-frame cadence. Raw image upload can be added later if we decide to run MediaPipe server-side.
