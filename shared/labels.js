export const activityLabels = {
  open: '打开页面',
  leave: '离开页面',
  'fullscreen-enter': '进入全屏',
  'fullscreen-exit': '退出全屏',
  hidden: '切到后台',
  visible: '回到前台',
  blur: '窗口失焦',
  focus: '窗口聚焦',
  paste: '粘贴',
  devtools: '尝试打开开发者工具',
}

export const flaggedActivity = ['fullscreen-exit', 'hidden', 'blur', 'paste', 'devtools']

export const phaseLabels = {
  pending: '未开始',
  choosing: '选题中',
  active: '作答中',
  passed: '已通过',
  abandoned: '已放弃',
  expired: '已超时',
}
