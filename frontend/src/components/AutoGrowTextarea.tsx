import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { ComponentPropsWithRef } from "react";

/** Textarea that grows with its content instead of showing a scrollbar. */
function AutoGrowTextarea({ ref, value, rows = 1, ...props }: ComponentPropsWithRef<"textarea">) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current!, []);

  useLayoutEffect(() => {
    resize(innerRef.current);
  }, [value]);

  // Wrapping changes with the available width, e.g. when a phone is rotated.
  useEffect(() => {
    const onResize = () => resize(innerRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return <textarea ref={innerRef} rows={rows} value={value} {...props} />;
}

function resize(textarea: HTMLTextAreaElement | null) {
  // scrollHeight is 0 while the element isn't rendered (e.g. inside a hidden panel).
  if (!textarea || textarea.scrollHeight === 0) {
    return;
  }
  textarea.style.height = "auto";
  const borders = textarea.offsetHeight - textarea.clientHeight;
  textarea.style.height = `${textarea.scrollHeight + borders}px`;
}

export default AutoGrowTextarea;
