import Svg, { Path } from "react-native-svg";

interface DeepSeekIconProps {
  size?: number;
  color?: string;
}

/** Simplified DeepSeek mark for provider lists. */
export function DeepSeekIcon({ size = 16, color = "currentColor" }: DeepSeekIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M4.5 12.5c0-4.3 3.4-7.8 7.7-7.8 2.6 0 4.9 1.2 6.3 3.1-.9-.4-1.9-.6-3-.6-3.7 0-6.7 2.9-6.7 6.5 0 1.3.4 2.5 1.1 3.5-3.1-.6-5.4-3.3-5.4-6.7z" />
      <Path d="M12.8 7.8c3.5 0 6.4 2.8 6.4 6.3 0 .7-.1 1.4-.4 2.1l2.7.9c.5-1 .7-2 .7-3 0-4.8-3.9-8.7-8.7-8.7-1.3 0-2.5.3-3.6.8.9-.3 1.9-.4 2.9-.4z" />
      <Path d="M9.2 14.2c0-2.3 1.9-4.2 4.2-4.2s4.2 1.9 4.2 4.2c0 .9-.3 1.8-.8 2.5l3.1 2.1c1.1-1.4 1.7-3.1 1.7-4.9 0-4.4-3.6-8-8.1-8S5 9.5 5 13.9c0 2.5 1.2 4.8 3.1 6.2l1.9-2.7c-.5-.9-.8-1.9-.8-3.2z" />
    </Svg>
  );
}
