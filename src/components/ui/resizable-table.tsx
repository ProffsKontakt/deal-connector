import * as React from "react";
import { cn } from "@/lib/utils";

interface ResizableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  minWidth?: number;
  defaultWidth?: number;
}

const ResizableTableHead = React.forwardRef<HTMLTableCellElement, ResizableTableHeadProps>(
  ({ className, children, minWidth = 60, defaultWidth, style, ...props }, ref) => {
    const [width, setWidth] = React.useState<number | undefined>(defaultWidth);
    const thRef = React.useRef<HTMLTableCellElement | null>(null);
    const isResizing = React.useRef(false);
    const startX = React.useRef(0);
    const startWidth = React.useRef(0);

    const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      isResizing.current = true;
      startX.current = e.clientX;
      startWidth.current = thRef.current?.offsetWidth || 100;
      
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;
        
        const diff = moveEvent.clientX - startX.current;
        const newWidth = Math.max(minWidth, startWidth.current + diff);
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }, [minWidth]);

    const setRefs = React.useCallback((node: HTMLTableCellElement | null) => {
      thRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    }, [ref]);

    return (
      <th
        ref={setRefs}
        className={cn(
          "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 relative select-none",
          className
        )}
        style={{ 
          ...style, 
          width: width ? `${width}px` : undefined,
          minWidth: `${minWidth}px`,
        }}
        {...props}
      >
        <div className="flex items-center gap-1 pr-3">
          <span className="truncate flex-1">{children}</span>
        </div>
        <div
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors z-10"
          onMouseDown={handleMouseDown}
        />
      </th>
    );
  }
);
ResizableTableHead.displayName = "ResizableTableHead";

export { ResizableTableHead };
