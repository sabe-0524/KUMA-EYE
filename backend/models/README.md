# Bear Detection Models

このディレクトリにYOLO熊検出モデル（bear_detector.pt）を配置してください。

## モデルの準備

### オプション1: YOLOv8プリトレーニングモデル（推奨）

YOLOv8のCOCOプリトレーニングモデルには「bear」クラスが含まれています：

```python
from ultralytics import YOLO

# YOLOv8nをダウンロード（自動）
model = YOLO('yolov8n.pt')
```

### オプション2: カスタムモデル

熊検出に特化したカスタムモデルをトレーニングする場合：

1. 熊の画像データセットを準備
2. YOLOv8でトレーニング
3. `bear_detector.pt` として保存

## COCOクラス（参考）

YOLOv8 COCOモデルのクラス21が「bear」です。
