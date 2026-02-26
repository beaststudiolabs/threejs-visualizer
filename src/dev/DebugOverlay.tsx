import type { FrameInfo } from "../ui/store/useAppStore";

type DebugOverlayProps = {
  frame: FrameInfo;
};

export const DebugOverlay = ({ frame }: DebugOverlayProps): JSX.Element => {
  return (
    <div className="debug-overlay" data-testid="debug-overlay">
      <span>FPS: {frame.fps.toFixed(1)}</span>
      <span>t: {frame.t.toFixed(2)}</span>
      <span>loopT: {frame.loopT.toFixed(3)}</span>
      <span>rms: {frame.audioRms.toFixed(3)}</span>
      <span>motion: {frame.motion.toFixed(3)}</span>
    </div>
  );
};
