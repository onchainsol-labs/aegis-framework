import Svg, { Path } from "react-native-svg";

interface SolanaLogoProps {
  size?: number;
  color?: string;
}

/** The Solana mark — three slanted bars, drawn with plain SVG paths so it
 *  works everywhere without an image asset. */
export function SolanaLogo({ size = 24, color = "#FFF7EC" }: SolanaLogoProps) {
  return (
    <Svg width={size} height={Math.round(size * 0.784)} viewBox="0 0 397 311" fill="none">
      <Path
        fill={color}
        d="M64.6 237.9C67.1 235.4 70.4 233.8 73.8 233.8H391.2C397 233.8 399.9 240.8 396.6 244.9L333.1 308.5C330.6 311 327.3 312.6 323.9 312.6H6.5C0.7 312.6 -2.2 305.6 1.1 301.5L64.6 237.9Z"
      />
      <Path
        fill={color}
        d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0H391.2C397 0 399.9 7 396.6 11.1L333.1 74.7C330.6 77.2 327.3 78.8 323.9 78.8H6.5C0.7 78.8 -2.2 71.8 1.1 67.7L64.6 3.8Z"
      />
      <Path
        fill={color}
        d="M333.1 120.1C330.6 117.7 327.3 116.2 323.9 116.2H6.5C0.7 116.2 -2.2 123.2 1.1 127.3L64.6 190.9C67.1 193.3 70.4 194.9 73.8 194.9H391.2C397 194.9 399.9 187.9 396.6 183.8L333.1 120.1Z"
      />
    </Svg>
  );
}
