import { ImageResponse } from "next/og";

// Statyczne metadane ikony — odpowiada w/h obrazu poniżej
export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 22,
          background: "#bce663",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#000",
          fontWeight: 800,
          letterSpacing: "-0.04em",
          borderRadius: 7,
        }}
      >
        h
      </div>
    ),
    { ...size }
  );
}
