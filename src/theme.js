// 统一配色：同时写入 CSS 变量（main.js）与 Naive UI 主题。布局尺寸见 style.css。
export const palette = {
  bg: '#101115',
  surface: '#1a1b1e',
  panel: '#303135',
  raised: '#3a3b3e',
  light: '#e9e8e6',
  text: '#e9e8e5',
  soft: '#bfc0c2',
  muted: '#8c8e92',
  line: '#ffffff14',
  red: '#e50032',
  orange: '#ff640c',
  gold: '#efb811',
  green: '#b9cf8a',
}

export const buttonVariants = {
  light: { color: palette.light, textColor: '#292a2d' },
  dark: { color: palette.raised, textColor: palette.text },
  primary: { color: palette.red, textColor: '#fff' },
  ghost: { color: palette.text, textColor: palette.text },
}

export const themeOverrides = {
  common: {
    primaryColor: palette.red,
    primaryColorHover: '#fa2148',
    primaryColorPressed: '#b50028',
    primaryColorSuppl: palette.red,
    bodyColor: palette.bg,
    cardColor: '#242529',
    modalColor: '#242529',
    popoverColor: palette.panel,
    textColorBase: palette.text,
    textColor1: palette.text,
    textColor2: palette.soft,
    textColor3: palette.muted,
    borderColor: '#494a4e',
    borderRadius: '3px',
    heightMedium: '40px',
    heightLarge: '48px',
    fontSize: '14px',
    fontFamily: "'HarmonyOS Sans SC', 'PingFang SC', 'Source Han Sans SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif",
    fontWeightStrong: '500',
  },
  Button: { fontWeight: '400', borderRadiusMedium: '3px', borderRadiusLarge: '3px', paddingMedium: '0 18px' },
  Popover: { padding: '0', borderRadius: '2px' },
  Card: { paddingMedium: '24px', titleFontWeight: '500', titleFontSizeMedium: '20px' },
}
