import {
  computePosition,
  flip,
  offset,
  shift,
  size,
  type ComputePositionConfig,
  type ReferenceElement,
} from "@floating-ui/dom";

export const previewPositionOptions: Partial<ComputePositionConfig> = {
  strategy: "fixed",
  placement: "bottom-start",
  middleware: [
    offset(10),
    // Try a shorter reading area below first; keep room for the toolbar and text.
    size({
      padding: 14,
      apply({ availableHeight, elements }) {
        elements.floating.style.maxHeight = `${Math.max(120, availableHeight)}px`;
      },
    }),
    flip({
      padding: 14,
      crossAxis: false,
      flipAlignment: false,
      fallbackStrategy: "initialPlacement",
    }),
    shift({ padding: 14, crossAxis: true }),
  ],
};

export function positionPreview(
  reference: ReferenceElement,
  popover: HTMLElement,
) {
  return computePosition(reference, popover, previewPositionOptions);
}
