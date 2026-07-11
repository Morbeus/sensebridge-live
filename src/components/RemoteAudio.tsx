import { useEffect, useRef } from "react";

interface RemoteAudioProps {
  streams: MediaStream[];
}

/** Invisibly plays every remote peer's audio track (the WebRTC "call"). */
export function RemoteAudio({ streams }: RemoteAudioProps) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }}>
      {streams.map((stream, i) => (
        <AudioEl key={stream.id ?? i} stream={stream} />
      ))}
    </div>
  );
}

function AudioEl({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}
