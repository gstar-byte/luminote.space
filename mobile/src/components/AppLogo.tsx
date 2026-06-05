import React from 'react';
import Svg, { Defs, LinearGradient, Stop, G, Path, Rect, Circle } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
};

/** 与 web `AppLogo` 完美对齐的移动端 Logo，包含 -26 度倾斜、三行胶囊条、星星、勾选框、小铃铛、纸张渐变及卷角阴影 */
export function AppLogo({ width = 36, height = 36 }: Props) {
  const suffix = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  
  const paperBgId = `paper-bg-${suffix}`;
  const curlBgId = `curl-bg-${suffix}`;
  const pillBlueId = `pill-blue-${suffix}`;
  const pillYellowId = `pill-yellow-${suffix}`;

  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      fill="none"
      style={{ overflow: 'visible' }}
    >
      <Defs>
        {/* 便签纸底色：极致经典且高端雅致的渐变淡黄色 (Classic Canary Yellow) */}
        <LinearGradient id={paperBgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFFDF0" />
          <Stop offset="100%" stopColor="#FEF08A" />
        </LinearGradient>
        
        {/* 卷角背面的立体渐变：模拟黄色纸张翻折的折角金黄暗面与高光 */}
        <LinearGradient id={curlBgId} x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#EAB308" />
          <Stop offset="40%" stopColor="#FEF08A" />
          <Stop offset="100%" stopColor="#FFFFFF" />
        </LinearGradient>

        <LinearGradient id={pillBlueId} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#3B82F6" />
          <Stop offset="100%" stopColor="#2563EB" />
        </LinearGradient>
        
        <LinearGradient id={pillYellowId} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#F97316" />
          <Stop offset="100%" stopColor="#FACC15" />
        </LinearGradient>
      </Defs>

      {/* 整体旋转：倾斜 -26 度 */}
      <G transform="rotate(-26, 50, 50)">
        
        {/* 1. 纸张底影 (用半透明路径模拟，高兼容且丝滑) */}
        <Path 
          d="M18 30 C18 23.3726 23.3726 18 30 18 H70 C76.6274 18 82 23.3726 82 30 V60 L60 82 H30 C23.3726 82 18 76.6274 18 70 Z" 
          fill="#000000"
          opacity={0.12}
          transform="translate(0, 2)"
        />

        {/* 2. 便签纸主体 */}
        <Path 
          d="M18 30 C18 23.3726 23.3726 18 30 18 H70 C76.6274 18 82 23.3726 82 30 V60 L60 82 H30 C23.3726 82 18 76.6274 18 70 Z" 
          fill={`url(#${paperBgId})`} 
        />

        {/* 3. 第一行：洋红胶囊 (未完成方块 + 右侧金黄色小五角星 ⭐️) */}
        <Rect x="25" y="28" width="6" height="6" rx="1.5" stroke="#EC4899" strokeWidth="1.2" fill="none" />
        <Rect x="35" y="28" width="28" height="6" rx="3" fill="#EC4899" />
        {/* 五角星 ⭐️ */}
        <Path 
          d="M75.5 27 L77.1 30.2 L80.6 30.7 L78.0 33.1 L78.6 36.6 L75.5 34.9 L72.4 36.6 L73.0 33.1 L70.4 30.7 L73.9 30.2 Z" 
          fill="#EAB308" 
        />

        {/* 4. 第二行：极客蓝胶囊 (已完成打勾复选框 + 右侧超圆润小铃铛 🔔) */}
        <Rect x="25" y="42" width="6" height="6" rx="1.5" fill={`url(#${pillBlueId})`} />
        <Path d="M26.5 45 L27.8 46.3 L30 44" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="35" y="42" width="31" height="6" rx="3" fill={`url(#${pillBlueId})`} />
        {/* iOS 风格小铃铛 */}
        <Path 
          d="M75.5 38.5 C74.2 38.5 73.2 39.8 73.2 41.2 C73.2 42.2 72.2 44.2 71.5 44.8 C71 45.3 71.5 46.2 72.8 46.2 H78.2 C79.5 46.2 80 45.3 79.5 44.8 C78.8 44.2 77.8 42.2 77.8 41.2 C77.8 39.8 76.8 38.5 75.5 38.5 Z" 
          fill={`url(#${pillBlueId})`} 
        />
        <Circle cx="75.5" cy="47.2" r="1.1" fill={`url(#${pillBlueId})`} />

        {/* 5. 第三行：明黄胶囊 (未完成方块) */}
        <Rect x="25" y="56" width="6" height="6" rx="1.5" stroke="#F97316" strokeWidth="1.2" fill="none" />
        <Rect x="35" y="56" width="20" height="6" rx="3" fill={`url(#${pillYellowId})`} />

        {/* 6. 卷角阴影 */}
        <Path 
          d="M60 82 C60 71 71 60 82 60 C71 71 71 82 60 82 Z" 
          fill="#000000"
          opacity={0.18}
          transform="translate(-1, 1)"
        />

        {/* 7. 掀起一角 (立体卷边效果) */}
        <Path 
          d="M60 82 C60 71 71 60 82 60 C71 71 71 82 60 82 Z" 
          fill={`url(#${curlBgId})`} 
        />
        <Path d="M60 82 L82 60" stroke="#EAB308" strokeOpacity="0.3" strokeWidth="0.5" />
        
      </G>
    </Svg>
  );
}
