import * as React from "react";
import { cn } from "@/lib/utils";

interface ResizableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  minWidth?: number;
  defaultWidth?: number;
}

const ResizableTableHead = React.forwardRef<HTMLTableCellElement, ResizableTableHeadProps>(
  ({ className, children, minWidth = 60, defaultWidth, style, ...props }, ref) => {
    const [width, setWidth] = React.useState<number | undefined>(defaultWidth);
    const [isResizing, setIsResizing] = React.useState(false);
    const thRef = React.useRef<HTMLTableCellElement | null>(null);
    const startX = React.useRef(0);
    const startWidth = React.useRef(0);

    React.useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        e.preventDefault();
        
        const diff = e.clientX - startX.current;
        const newWidth = Math.max(minWidth, startWidth.current + diff);
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        if (isResizing) {
          setIsResizing(false);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      };

      if (isResizing) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isResizing, minWidth]);

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      setIsResizing(true);
      startX.current = e.clientX;
      startWidth.current = thRef.current?.offsetWidth || defaultWidth || 100;
      
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

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
          "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 relative select-none group/resize whitespace-nowrap border-r border-border/30 last:border-r-0",
          isResizing && "bg-muted/30",
          className
        )}
        style={{ 
          ...style, 
          width: width !== undefined ? `${width}px` : (defaultWidth ? `${defaultWidth}px` : 'auto'),
          minWidth: width !== undefined ? `${width}px` : `${minWidth}px`,
          maxWidth: width !== undefined ? `${width}px` : undefined,
        }}
        {...props}
      >
        <div className="flex items-center gap-1 pr-2 overflow-hidden">
          <span className="truncate">{children}</span>
        </div>
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center",
            "opacity-0 group-hover/resize:opacity-100 transition-opacity",
            isResizing && "opacity-100"
          )}
          onMouseDown={handleMouseDown}
          style={{ touchAction: 'none' }}
        >
          <div className={cn(
            "w-0.5 h-6 rounded-full transition-colors",
            isResizing ? "bg-primary" : "bg-border hover:bg-primary/50"
          )} />
        </div>
      </th>
    );
  }
);
ResizableTableHead.displayName = "ResizableTableHead";

export { ResizableTableHead };
