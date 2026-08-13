---
id: bug-20260813-python-php-ruby-stdlib-3-parti-importlari-unresolv
type: bug
project: seriftech-packages
module: graph
title: "Python/PHP/Ruby stdlib+3.parti importlari 'unresolved' sayiliyordu (avatarx 383 yanlis alarm)"
status: done
priority: high
severity: high
owner: ""
created_at: "2026-08-13T06:51:35.697Z"
updated_at: "2026-08-13T06:52:06.266Z"
source:
  kind: manual
  path: ""
relations:
  files: [src/graph/build.mjs, src/scanner/resolve-import.mjs]
  decisions: []
  bugs: []
  modules: [graph]
tags: []
summary: "Python/PHP/Ruby stdlib+3.parti importlari 'unresolved' sayiliyordu (avatarx 383 yanlis alarm)"
completed_at: "2026-08-13"
---
# Python/PHP/Ruby stdlib+3.parti importlari 'unresolved' sayiliyordu (avatarx 383 yanlis alarm)

## Etki

## Reproduce
1. 

## Beklenen

## Gozlemlenen

## Hipotez / Analiz

## Next Action

## Tamamlanma (2026-08-13)

resolve-import.mjs Python/PHP/Ruby icin kind:'external' donduruyordu ama build.mjs bu dali HIC ele almiyordu → son else'e dusup unresolved sayiliyordu. Uc kategori ayristirildi: stdlib (dille gelir, bagimlilik DEGIL, sayilmaz — PYTHON_STDLIB/RUBY_STDLIB setleri), external (3. parti, bagimlilik dugumu urer), cozulemeyen (gercek sinyal). PHP haric tutuldu: orada require hep bir YOLDUR (vendor/autoload.php), yoldan paket adi uydurmak yanlis dugum uretirdi. Olcum avatarx (536 import): unresolved 383 → 1, bagimlilik dugumu 0 → 11 (numpy/cv2/torch/scipy/mediapipe/trimesh/bpy/fastapi/PIL/onnxruntime/uvicorn). A/B (HEAD worktree) ile JS yolunda regresyon YOK: GameX 2→2, klavye-savas 11→11; serif-platform 259→43 ve edux 72→68 duserken DUSEN dugum 0, eklenen 8 dugumun hepsi gercek (bpy/bmesh/mathutils/insightface/numpy/PIL/addon_utils/bl_ext).
