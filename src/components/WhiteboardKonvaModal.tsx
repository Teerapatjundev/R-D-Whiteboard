import React, { useEffect, useRef, useState, useCallback } from "react";
import Draggable, { DraggableData, DraggableEvent } from "react-draggable";
import { Resizable } from "re-resizable";
import {
  Stage,
  Layer,
  Line,
  Rect as KonvaRect,
  Circle as KonvaCircle,
  Image as KonvaImage,
} from "react-konva";
import { GalleryBar } from "./GalleryBar";

/* =========================
   Types & Utils
   ========================= */

enum ToolType {
  MouseControl = "mouseControl",
  Pen = "pen",
  Highlight = "Highlight",
  Brush = "brush",
  Square = "square",
  Circle = "circle",
  Eraser = "eraser",
  Save = "save",
  ClearAll = "clearAll",
  Undo = "undo",
  Redo = "redo",
  Arrow = "arrow",
  Cursor = "cursor",
  Null = "null",
  Close = "Close",
  Note = "Note",
}

type LineShape = {
  tool: ToolType;
  color: string;
  stroke: number;
  points: number[]; // normalized [x1,y1,x2,y2,...]
  keyOfPage?: string;
};
type CircleShape = {
  tool: "Circle";
  color: string;
  stroke: number;
  circle: { x: number; y: number; radius: number }; // normalized
  keyOfPage?: string;
};
type RectShape = {
  tool: "Square";
  color: string;
  stroke: number;
  rectangle: { x: number; y: number; width: number; height: number }; // normalized
  keyOfPage?: string;
};
type ImageShape = {
  tool: "Image";
  src: string;
  x: number;
  y: number;
  width: number; // normalized (ต่อความกว้าง stage)
  height: number; // normalized (ต่อความสูง stage) — จะปรับอัตราส่วนให้ครั้งเดียวหลังรูปโหลด
};
type AnyShape = LineShape | CircleShape | RectShape | ImageShape;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const denormX = (W: number, nx: number) => nx * W;
const denormY = (H: number, ny: number) => ny * H;
const ratioForLine = (W: number, H: number, normalized: number[]) => {
  const pts: number[] = [];
  for (let i = 0; i < normalized.length; i += 2) {
    pts.push(denormX(W, normalized[i]), denormY(H, normalized[i + 1]));
  }
  return pts;
};

const FOOTER_HEIGHT = 56;
const PADDING_H = 40;
const PADDING_V = 40;
const NAV_BAR_H = 40;
const GALLERY_H = 96; // ความสูงแถวรูปโดยประมาณ (ให้ GalleryBar สูงคงที่ประมาณนี้)

/* =========================
   Hooks
   ========================= */
const useWindowSize = () => {
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
};

const useImageEl = (url: string) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = url;
  }, [url]);
  return image;
};

/* =========================
   Component
   ========================= */
const WhiteboardKonvaModal: React.FC = () => {
  /* ---- sizing / centering ---- */
  const { w: windowW, h: windowH } = useWindowSize();
  const baseWidth = Math.max(280, windowW - PADDING_H * 2);
  const baseHeight = Math.max(240, windowH - FOOTER_HEIGHT - PADDING_V * 2);

  const [size, setSize] = useState({ width: baseWidth, height: baseHeight });
  useEffect(() => {
    setSize((prev) => ({
      width: Math.min(prev.width, baseWidth),
      height: Math.min(prev.height, baseHeight),
    }));
  }, [baseWidth, baseHeight]);

  // พื้นที่วาดจริง (หัก header + gallery)
  const stageH = Math.max(0, size.height - NAV_BAR_H - GALLERY_H);
  const stageW = size.width;

  // Draggable (controlled)
  const draggableRef = useRef<HTMLDivElement | null>(null);
  const initialPos = {
    x: Math.max(0, (windowW - size.width) / 2),
    y: Math.max(0, (windowH - size.height) / 2),
  };
  const [position, setPosition] = useState<{ x: number; y: number }>(
    initialPos
  );

  const onStartModalTableContent = (
    _event: DraggableEvent,
    uiData: DraggableData
  ) => {
    const targetRect = draggableRef.current?.getBoundingClientRect();
    if (!targetRect) {
      return;
    }
    setPosition({ x: uiData.x, y: uiData.y });
  };

  const onStopModalTableContent = (
    _event: DraggableEvent,
    uiData: DraggableData
  ) => {
    const targetRect = draggableRef.current?.getBoundingClientRect();
    if (!targetRect) {
      return;
    }
    setPosition({ x: uiData.x, y: uiData.y });
  };

  /* ---- drawing state ---- */
  const [shapes, setShapes] = useState<AnyShape[]>([]);
  const [toolActive, setToolActive] = useState<ToolType>(ToolType.Pen);
  const isDrawingRef = useRef(false);

  const onMouseDown = useCallback(
    (e: any) => {
      console.log("in");

      if (
        !(
          toolActive === ToolType.Pen ||
          toolActive === ToolType.Highlight ||
          toolActive === ToolType.Eraser
        )
      )
        return;
      isDrawingRef.current = true;
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const nx = clamp(pos.x / stageW, 0, 1);
      const ny = clamp(pos.y / stageH, 0, 1);
      const color =
        toolActive === ToolType.Highlight ? "rgba(255,255,0,0.5)" : "#222";
      const stroke = toolActive === ToolType.Eraser ? 24 : 3;
      setShapes((prev) => [
        ...prev,
        { tool: toolActive, color, stroke, points: [nx, ny] } as LineShape,
      ]);
    },
    [toolActive, stageW, stageH]
  );

  const onMouseMove = useCallback(
    (e: any) => {
      if (!isDrawingRef.current) return;
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      if (!pos) return;
      setShapes((prev) => {
        if (!prev.length) return prev;
        const last = prev[prev.length - 1];
        if (
          last.tool === ToolType.Pen ||
          last.tool === ToolType.Highlight ||
          last.tool === ToolType.Eraser
        ) {
          const nx = clamp(pos.x / stageW, 0, 1);
          const ny = clamp(pos.y / stageH, 0, 1);
          const updated = [...prev];
          (updated[updated.length - 1] as LineShape).points = [
            ...last.points,
            nx,
            ny,
          ];
          return updated;
        }
        return prev;
      });
    },
    [stageW, stageH]
  );

  const onMouseUp = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  /* ---- drag image onto canvas (precise) ---- */
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null); // Konva Stage ref

  const dropAtPointer = useCallback(
    (src: string, e: DragEvent) => {
      if (!stageRef.current) return;
      stageRef.current.setPointersPositions(e as any);
      const pos = stageRef.current.getPointerPosition();
      if (!pos) return;
      const nx = clamp(pos.x / stageW, 0, 1);
      const ny = clamp(pos.y / stageH, 0, 1);
      const nW = 0.25,
        nH = 0.25;
      setShapes((prev) => [
        ...prev,
        {
          tool: "Image",
          src,
          x: nx,
          y: ny,
          width: nW,
          height: nH,
        } as ImageShape,
      ]);
    },
    [stageW, stageH]
  );

  // ให้ GalleryBar เรียกได้เวลาเลือกไฟล์อัปโหลด (วางกลางกระดาน)
  useEffect(() => {
    (window as any).__dropImageFromUpload = (dataUrl: unknown) => {
      if (typeof dataUrl !== "string") return;

      const rect = stageContainerRef.current?.getBoundingClientRect();
      const centerX = (rect?.left ?? 0) + stageW / 2;
      const centerY = (rect?.top ?? 0) + stageH / 2;

      // สร้างอ็อบเจ็กต์ที่พอมี clientX/Y ให้ setPointersPositions ใช้ได้
      const fakeEvent = {
        clientX: centerX,
        clientY: centerY,
      } as unknown as DragEvent;
      dropAtPointer(dataUrl, fakeEvent);
    };

    return () => {
      (window as any).__dropImageFromUpload = undefined;
    };
  }, [dropAtPointer, stageW, stageH]);

  // desktop HTML5 DnD (ลากไฟล์/รูปจากนอกหรือจาก gallery ที่ใช้ dataTransfer)
  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;

    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const ds = e.dataTransfer;
      if (!ds) return;

      // กรณีลากมาจากแกลเลอรี่ในแอป (setData "text/plain" เป็น src)
      const s = ds.getData("text/plain");
      if (s) {
        dropAtPointer(s, e);
        return;
      }

      // กรณีลากไฟล์รูปจริงจากเครื่อง
      const f = ds.files?.[0];
      if (f && f.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string") {
            dropAtPointer(result, e);
          }
        };
        reader.readAsDataURL(f);
      }
    };

    // บางเบราว์เซอร์ต้องกันทั้ง dragenter/dragover เพื่อให้ drop ทำงาน
    el.addEventListener("dragenter", prevent);
    el.addEventListener("dragover", prevent);
    el.addEventListener("drop", onDrop);

    return () => {
      el.removeEventListener("dragenter", prevent);
      el.removeEventListener("dragover", prevent);
      el.removeEventListener("drop", onDrop);
    };
  }, [dropAtPointer]);

  // เดิม: effect ที่ผูก dragover/drop (คงไว้)
  // เพิ่ม: ฟัง mobile-drag-end แล้วเรียก dropAtPointer ด้วยพิกัด touch
  useEffect(() => {
    const onMobileDrop = (ev: any) => {
      const { src, x, y } = ev.detail || {};
      if (!src) return;
      const fake = { clientX: x, clientY: y } as unknown as DragEvent;
      dropAtPointer(src, fake);
    };
    window.addEventListener("mobile-drag-end", onMobileDrop as any);
    return () =>
      window.removeEventListener("mobile-drag-end", onMobileDrop as any);
  }, [dropAtPointer]);

  // ---- Konva image renderer (memo) ----
  type RenderImageProps = {
    shape: ImageShape;
    index: number;
    stageW: number;
    stageH: number;
    commitPos: (index: number, nx: number, ny: number) => void;
    commitHeightByAspect: (index: number, nh: number) => void;
  };

  const RenderImageBase: React.FC<RenderImageProps> = ({
    shape,
    index,
    stageW,
    stageH,
    commitPos,
    commitHeightByAspect,
  }) => {
    const imgEl = useImageEl(shape.src);

    // คำนวณพิกัด/ขนาดจาก normalized → px
    const px = shape.x * stageW;
    const py = shape.y * stageH;
    const targetW = shape.width * stageW;
    const desiredHByAspect = imgEl
      ? targetW * (imgEl.height / imgEl.width)
      : shape.height * stageH;
    const targetH = desiredHByAspect;

    // commit normalize height ตามอัตราส่วน "ครั้งเดียว" หลังภาพโหลด
    useEffect(() => {
      if (!imgEl) return;
      const nh = desiredHByAspect / stageH;
      if (Math.abs(nh - shape.height) > 0.001) {
        commitHeightByAspect(index, nh);
      }
    }, [
      imgEl,
      desiredHByAspect,
      stageH,
      shape.height,
      index,
      commitHeightByAspect,
    ]);

    const handleDragEnd = React.useCallback(
      (ev: any) => {
        const { x, y } = ev.target.position();
        const nx = clamp(x / stageW, 0, 1);
        const ny = clamp(y / stageH, 0, 1);
        commitPos(index, nx, ny); // ← setState เฉพาะตอน dragend
      },
      [index, stageW, stageH, commitPos]
    );

    return (
      <KonvaImage
        image={imgEl || undefined}
        x={px}
        y={py}
        width={targetW}
        height={targetH}
        offsetX={targetW / 2}
        offsetY={targetH / 2}
        draggable
        onDragEnd={handleDragEnd}
      />
    );
  };

  // areEqual: rerender เมื่อ shape reference เปลี่ยน หรือ stage size เปลี่ยนเท่านั้น
  const RenderImage = React.memo(RenderImageBase, (prev, next) => {
    return (
      prev.shape === next.shape &&
      prev.index === next.index &&
      prev.stageW === next.stageW &&
      prev.stageH === next.stageH
    );
  });

  // helper stable callbacks เพื่อส่งเข้า memo child
  const commitPos = useCallback((index: number, nx: number, ny: number) => {
    setShapes((prev) => {
      const u = [...prev];
      const img = u[index] as ImageShape;
      u[index] = { ...img, x: nx, y: ny };
      return u;
    });
  }, []);

  const commitHeightByAspect = useCallback((index: number, nh: number) => {
    setShapes((prev) => {
      const u = [...prev];
      const img = u[index] as ImageShape;
      u[index] = { ...img, height: nh };
      return u;
    });
  }, []);

  /* ---- styles ---- */
  const wbWrapperStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 100,
  };
  const cardStyle: React.CSSProperties = {
    borderRadius: 12,
    background: "#fafafa",
    border: "1px solid #eee",
    overflow: "hidden",
    position: "relative",
  };
  const headerStyle: React.CSSProperties = {
    height: NAV_BAR_H,
    display: "flex",
    alignItems: "center",
    fontWeight: 700,
    width: "100%",
    background: "#fff",
    borderBottom: "1px solid #eee",
    cursor: "grab",
    userSelect: "none",
  };

  const stageProps = {
    ref: stageRef,
    width: stageW,
    height: stageH,
    onMouseDown,
    onMousemove: onMouseMove,
    onMouseup: onMouseUp,
    onTouchStart: onMouseDown,
    onTouchMove: onMouseMove,
    onTouchEnd: onMouseUp,
  };

  /* ---- render ---- */
  return (
    <Draggable
      nodeRef={draggableRef}
      handle=".draggable-handle"
      cancel=".cancel-drag, .re-resizable-handle, .resize-handle-br, .konvajs-content"
      bounds="parent"
      position={position}
      onStop={(event, uiData) => onStopModalTableContent(event, uiData)}
      onStart={(event, uiData) => onStartModalTableContent(event, uiData)}
    >
      <div style={wbWrapperStyle} ref={draggableRef}>
        <Resizable
          size={{ width: size.width, height: size.height }}
          onResizeStop={(_, __, ref) => {
            const newW = Number(ref.style.width.replace("px", ""));
            const newH = Number(ref.style.height.replace("px", ""));
            setSize({
              width: clamp(newW, 280, baseWidth),
              height: clamp(newH, 240, baseHeight),
            });
          }}
          minWidth={280}
          minHeight={240}
          maxWidth={baseWidth}
          maxHeight={baseHeight}
          enable={{
            top: true,
            right: true,
            bottom: true,
            left: true,
            topLeft: true,
            topRight: true,
            bottomLeft: true,
            bottomRight: true,
          }}
          handleComponent={{
            bottomRight: (
              <div className="resize-handle-br" aria-label="Resize">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    d="M4 20 L20 4 M8 20 L20 8 M12 20 L20 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
              </div>
            ),
          }}
          handleStyles={{
            bottomRight: {
              width: 18,
              height: 18,
              right: 0,
              bottom: 0,
              cursor: "nwse-resize",
              display: "grid",
              placeItems: "center",
              background: "rgba(0,0,0,0.06)",
              borderTopLeftRadius: 6,
            },
          }}
          style={cardStyle}
        >
          {/* Header (drag handle) */}
          <div className="draggable-handle" style={headerStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                padding: "0 12px",
              }}
            >
              <span>☰ Whiteboard Nav</span>
              <span>X</span>
            </div>
          </div>
          <button
            onClick={() => {
              setToolActive(ToolType.Pen);
            }}
          >
            Pen
          </button>
          <button
            onClick={() => {
              setToolActive(ToolType.Cursor);
            }}
          >
            Cursor
          </button>
          {/* Mockup gallery (draggable images) */}
          <GalleryBar className="cancel-drag" />

          {/* Canvas area */}
          <div
            ref={stageContainerRef}
            style={{ width: "100%", height: stageH, touchAction: "none" }}
          >
            <Stage {...stageProps}>
              {/* Layer รูปภาพ (แยกออกมา ลดรีเรนเดอร์ร่วมกับเส้น) */}
              <Layer>
                {shapes.map((s, i) =>
                  s.tool === "Image" ? (
                    <RenderImage
                      key={`img-${i}`}
                      shape={s}
                      index={i}
                      stageW={stageW}
                      stageH={stageH}
                      commitPos={commitPos}
                      commitHeightByAspect={commitHeightByAspect}
                    />
                  ) : null
                )}
              </Layer>

              {/* Layer วาดเส้น/รูปทรง */}
              <Layer>
                {shapes.map((s, i) => {
                  if (
                    s.tool === ToolType.Pen ||
                    s.tool === ToolType.Highlight ||
                    s.tool === ToolType.Eraser
                  ) {
                    return (
                      <Line
                        key={`line-${i}`}
                        points={ratioForLine(stageW, stageH, s.points)}
                        stroke={s.tool === ToolType.Eraser ? "#000" : s.color}
                        strokeWidth={s.stroke}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                        draggable={false}
                        globalCompositeOperation={
                          s.tool === ToolType.Eraser
                            ? "destination-out"
                            : "source-over"
                        }
                      />
                    );
                  }
                  if (s.tool === "Circle" && "circle" in s) {
                    const cx = denormX(stageW, s.circle.x);
                    const cy = denormY(stageH, s.circle.y);
                    const r = denormX(stageW, s.circle.radius);
                    return (
                      <KonvaCircle
                        key={`circle-${i}`}
                        x={cx}
                        y={cy}
                        radius={r}
                        stroke={s.color}
                        strokeWidth={s.stroke}
                      />
                    );
                  }
                  if (s.tool === "Square" && "rectangle" in s) {
                    const rx = denormX(stageW, s.rectangle.x);
                    const ry = denormY(stageH, s.rectangle.y);
                    const rw = denormX(stageW, s.rectangle.width);
                    const rh = denormY(stageH, s.rectangle.height);
                    return (
                      <KonvaRect
                        key={`rect-${i}`}
                        x={rx}
                        y={ry}
                        width={rw}
                        height={rh}
                        stroke={s.color}
                        strokeWidth={s.stroke}
                      />
                    );
                  }
                  return null;
                })}
              </Layer>
            </Stage>
          </div>
        </Resizable>
      </div>
    </Draggable>
  );
};

export default WhiteboardKonvaModal;
