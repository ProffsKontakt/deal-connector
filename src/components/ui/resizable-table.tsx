import * as React from "react";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

interface ResizableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  minWidth?: number;
  defaultWidth?: number;
}

const ResizableTableHead = React.forwardRef<HTMLTableCellElement, ResizableTableHeadProps>(
  ({ className, children, minWidth = 60, defaultWidth, style, ...props }, ref) => {
    const [width, setWidth] = React.useState<number | undefined>(defaultWidth);
    const [isResizing, setIsResizing] = React.useState(false);
    const startXRef = React.useRef<number>(0);
    const startWidthRef = React.useRef<number>(0);
    const thRef = React.useRef<HTMLTableCellElement | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = thRef.current?.offsetWidth || 100;
      
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    React.useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        
        const diff = e.clientX - startXRef.current;
        const newWidth = Math.max(minWidth, startWidthRef.current + diff);
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
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
          "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 relative group select-none",
          isResizing && "bg-muted/50",
          className
        )}
        style={{ 
          ...style, 
          width: width ? `${width}px` : undefined,
          minWidth: `${minWidth}px`,
        }}
        {...props}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate flex-1">{children}</span>
          <div
            className={cn(
              "absolute right-0 top-0 h-full w-4 cursor-col-resize flex items-center justify-center",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              isResizing && "opacity-100"
            )}
            onMouseDown={handleMouseDown}
          >
            <div className={cn(
              "w-0.5 h-4 bg-border rounded-full transition-colors",
              isResizing && "bg-primary"
            )} />
          </div>
        </div>
      </th>
    );
  }
);
ResizableTableHead.displayName = "ResizableTableHead";

export { ResizableTableHead };
