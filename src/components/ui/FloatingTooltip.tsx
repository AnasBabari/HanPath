import React, { useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  arrow,
} from '@floating-ui/react';

interface FloatingTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  showAlways?: boolean;
}

export default function FloatingTooltip({ children, content, showAlways = false }: FloatingTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [arrowElement, setArrowElement] = React.useState<HTMLDivElement | null>(null);

  const openState = showAlways ? true : isOpen;

  const { refs, floatingStyles, context, middlewareData } = useFloating({
    open: openState,
    onOpenChange: setIsOpen,
    placement: 'top',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(12),
      flip({ fallbackAxisSideDirection: 'start' }),
      shift({ padding: 16 }), // This ensures it stays on screen!
      arrow({ element: arrowElement }),
    ],
  });
  const setFloatingRef = React.useCallback((node: HTMLDivElement | null) => {
    refs.setFloating(node);
  }, [refs]);
  const setReferenceRef = React.useCallback((node: HTMLDivElement | null) => {
    refs.setReference(node);
  }, [refs]);

  const hover = useHover(context, { move: false, enabled: !showAlways });
  const focus = useFocus(context, { enabled: !showAlways });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      <div ref={setReferenceRef} {...getReferenceProps()} className="inline-block relative">
        {children}
      </div>
      
      {openState && (
        <FloatingPortal>
          <div
            ref={setFloatingRef}
            style={{ ...floatingStyles, transitionProperty: 'opacity, transform' }}
            {...getFloatingProps()}
            className="z-50 glass-tooltip border border-outline-variant p-4 rounded-2xl shadow-xl bg-white/95 backdrop-blur-md transition-opacity transition-transform duration-300 w-64 max-w-[calc(100vw-32px)] text-left"
          >
            {content}
            <div
              ref={setArrowElement}
              className="absolute w-4 h-4 rotate-45 border-r border-b border-outline-variant bg-white"
              style={{
                left: middlewareData.arrow?.x != null ? `${middlewareData.arrow.x}px` : '',
                top: middlewareData.arrow?.y != null ? `${middlewareData.arrow.y}px` : '',
                right: '',
                bottom: '',
                [context.placement.startsWith('top') ? 'bottom' : 'top']: '-8px',
              }}
            />
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
