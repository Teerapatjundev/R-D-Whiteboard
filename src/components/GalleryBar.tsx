type GalleryBarProps = {
  className?: string;
};

const GALLERY_IMAGES = [
  "https://picsum.photos/seed/101/240/160",
  "https://picsum.photos/seed/102/240/160",
  "https://picsum.photos/seed/103/240/160",
  "https://picsum.photos/seed/104/240/160",
  "https://picsum.photos/seed/105/240/160",
];

export const GalleryBar: React.FC<GalleryBarProps> = ({ className }) => {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        gap: 8,
        padding: "8px 12px",
        borderBottom: "1px solid #eee",
        background: "#fff",
        overflowX: "auto",
        alignItems: "center",
      }}
      aria-label="Draggable image gallery"
      role="list"
    >
      {GALLERY_IMAGES.map((src, i) => (
        <img
          key={i}
          src={src}
          width={120}
          height={80}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              "text/plain",
              (e.target as HTMLImageElement).src
            );
          }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            const img = e.target as HTMLImageElement;
            img.setAttribute("data-drag-src", img.src);
            window.dispatchEvent(
              new CustomEvent("mobile-drag-start", {
                detail: { src: img.src, x: t.clientX, y: t.clientY },
              })
            );
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            window.dispatchEvent(
              new CustomEvent("mobile-drag-move", {
                detail: { x: t.clientX, y: t.clientY },
              })
            );
          }}
          onTouchEnd={(e) => {
            const img = e.target as HTMLImageElement;
            const t = e.changedTouches[0];
            const src = img.getAttribute("data-drag-src");
            window.dispatchEvent(
              new CustomEvent("mobile-drag-end", {
                detail: { src, x: t.clientX, y: t.clientY },
              })
            );
            img.removeAttribute("data-drag-src");
          }}
          style={{
            borderRadius: 8,
            userSelect: "none",
            flex: "0 0 auto",
            objectFit: "cover",
            border: "1px solid #eee",
            touchAction: "none", // ← สำคัญ
          }}
          alt={`mock-${i + 1}`}
          role="listitem"
        />
      ))}

      {/* ช่องอัปโหลดไฟล์จริง */}
      <label
        style={{
          border: "1px dashed #ccc",
          borderRadius: 8,
          padding: 8,
          fontSize: 12,
          color: "#666",
          display: "grid",
          placeItems: "center",
          width: 120,
          height: 80,
          cursor: "pointer",
          flex: "0 0 auto",
          background: "#fafafa",
        }}
        title="Upload an image to drop into the board"
      >
        Upload
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = (e2) => {
              // ปล่อยรูปกลางกระดานแบบง่าย ๆ (ใช้คลิกปลอม)
              const fakeDrop = {
                clientX: 0,
                clientY: 0,
              } as unknown as DragEvent;
              // เซ็ต src ลง dataTransfer ผ่าน handler drop ของคุณไม่ได้โดยตรง
              // เลยเรียก pushImageFromSrc ในโค้ดหลักแทน (ดูบันทึกด้านล่าง)
              // → ดู “ข้อสำคัญ” ด้านล่างเพื่อเชื่อมกับ pushImageFromSrc
              (window as any).__dropImageFromUpload?.(e2.target?.result);
            };
            reader.readAsDataURL(f);
          }}
        />
      </label>
    </div>
  );
};
