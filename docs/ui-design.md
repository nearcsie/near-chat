# UI Design Document

This document defines the UI styling specifications, theme tokens, design guidelines, and interface mockups for the application.

---

## 1. Design System Tokens (Border UI)

The Border UI system is built on **structural minimalism** and **high-fidelity utility**, prioritizing 1px shared borders, high contrast, and distraction-free communication.

### Design Variables

```yaml
colors:
  surface: '#faf9fe'
  surface-dim: '#dad9df'
  surface-bright: '#faf9fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f8'
  surface-container: '#eeedf3'
  surface-container-high: '#e9e7ed'
  surface-container-highest: '#e3e2e7'
  on-surface: '#1a1b1f'
  on-surface-variant: '#414755'
  inverse-surface: '#2f3034'
  inverse-on-surface: '#f1f0f5'
  outline: '#717786'
  outline-variant: '#c1c6d7'
  surface-tint: '#005bc1'
  primary: '#0058bc'
  on-primary: '#ffffff'
  primary-container: '#0070eb'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#9e3d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c64f00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb595'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7c2e00'
  background: '#faf9fe'
  on-background: '#1a1b1f'
  surface-variant: '#e3e2e7'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-padding: 24px
  gutter: 1px
```

---

## 2. Brand & Style Guidelines

* **Pure Monochromes**: #000000 and #FFFFFF are used for surfaces and primary borders. In Dark Mode, the canvas is pure black and structural elements are pure white.
* **Accent Action**: Electric Blue (#007AFF) is the singular action signal for focus states, primary buttons, and interactions.
* **Grid & Layout**: Uses a fixed-stroke layout. Containers are butted directly against one another, separated by a 1px shared border, with internal container padding of 24px. All spacing is in multiples of 4px.
* **No Shadows/Elevation**: Rejects Z-axis drop shadows. Layering is handled by Z-index ordering and explicit 1px borders. Interactive elements shift 1px down and 1px right to simulate pressing, or highlight the border with #007AFF.
* **Geometry**: Corner radius is limited to 4px (`rounded-sm`). Status pips use 4x4px squares rather than circles.
* **Typography Hierarchy**: Fonts are Inter (Geist Sans) for UI copy and JetBrains Mono (Geist Mono) for technical codes/times. Boldness/weights communicate hierarchy.

---

## 3. Core Component Styles

* **Buttons**:
  - *Primary*: Solid #007AFF background, white text, 4px radius.
  - *Secondary*: Transparent, 1px border (#000000 / #FFFFFF), 4px radius.
  - *Ghost*: Borderless, transparent, action text. Text underlines on hover.
* **Input Fields**: Default 1px border (#D1D1D6), 4px radius. Action-focused input changes border to #007AFF with no outline shadow glow.
* **Chat Bubbles**: Rectangular boxes with 1px border.
  - *Incoming*: White surface, 1px black border.
  - *Outgoing*: Light grey (#F2F2F7) background or solid #007AFF.
* **Lists**: Elements separated by 1px horizontal lines. Active list item gets a 4px vertical bar of #007AFF on the side margin.

---

## 4. UI Page Wireframes & Layout Notes

### Routes
- `/` - Main Chat Page
- `/login` - Login Page
- `/register` - Registration Page
- `/settings` - Profile and App Settings

---

### Login Page Layout
```text
┌──────────────────────────────────────────────┐
│                  [ APP ICON ]                │
│                                              │
│                 歡迎回來！                   │
│                登入您的帳戶                  │
│                                              │
│   電子郵件 ────────────────────────────────  │
│   [ your@email.com                         ] │
│                                              │
│   密碼 ────────────────────────────────────  │
│   [ ••••••••                               ] │
│                                              │
│   [ ] 記住我                                 │
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │                登入                  │   │
│   └──────────────────────────────────────┘   │
│                                              │
│         還沒有帳號？ 立即註冊                  │
└──────────────────────────────────────────────┘
```

---

### Register Page Layout
```text
┌──────────────────────────────────────────────┐
│                  [ APP ICON ]                │
│                                              │
│                  建立帳號                    │
│               開始與朋友聊天                 │
│                                              │
│   使用者名稱 ──────────────────────────────  │
│   [ 您的名稱                               ] │
│                                              │
│   電子郵件 ────────────────────────────────  │
│   [ your@email.com                         ] │
│                                              │
│   密碼 ────────────────────────────────────  │
│   [ 至少 8 個字元                          ] │
│                                              │
│   確認密碼 ────────────────────────────────  │
│   [ 再次輸入密碼                           ] │
│                                              │
│   ┌──────────────────────────────────────┐   │
│   │                註冊                  │   │
│   └──────────────────────────────────────┘   │
│                                              │
│         已經有帳號？ 立即登入                  │
└──────────────────────────────────────────────┘
```

---

### Main Chat Layout (Split View)
```text
┌────────────┬─────────────────────────────┬──────────┐
│ DB-9CHAT + │ 師大資工117              ⚙  │ 成員列表 │
├────────────┼─────────────────────────────┼──────────┤
│ 💬 陳小明  │ [Bob] 訊息內容...     12:00 │  我 (O)  │
│            │                             │  王同學  │
│ 📁 學業    │ [我] 回覆內容...      12:02 │  陳同學  │
│ ├─💬 專題  │                             │          │
│ └─💬 報告  │                             │          │
│            ├─────────────────────────────┤          │
│ 💬 吳同學  │ [附件] file.pdf             │          │
│            │ ─────────────────────────── │          │
│            │ [ 輸入訊息...           ] 📎│          │
└────────────┴─────────────────────────────┴──────────┘
```

#### Left Sidebar:
- App Title and `+` button to create rooms or folders.
- Active Chats list and Folders (with collapsible sub-items).
- User Profile footer with a link to Settings and a Logout button.

#### Main Chat Area:
- Header: Room Name, settings gear (if group), options dropdown (Edit nickname, Leave room, Block).
- Message List: Timestamps, recalled message tags, reply references, and file attachment chips.
- Message Input: Field with attachment file clip icon.

---

### Settings Page Layout
```text
┌──────────────────────────────────────────────┐
│  ← 返回聊天                                  │
│                                              │
│  個人資料 ─────────────────────────────────  │
│  使用者名稱 [ 您的名稱                     ] │
│  電子郵件   [ user@email.com               ]  (唯讀)
│  頭像       [ 變更頭像                     ] │
│                                              │
│  通知設定 ─────────────────────────────────  │
│  [x] 啟用桌面通知                            │
│  [x] 啟用訊息音效                            │
│                                              │
│  外觀設定 ─────────────────────────────────  │
│  主題偏好   [ 淺色 | 深色                  ] │
│  語言偏好   [ 繁體中文 | English           ] │
│                                              │
│  遺言模式 ─────────────────────────────────  │
│  [x] 啟用遺言自動發送                        │
│  觸發天數   [ 30                         ] 天│
│                                              │
│  安全設定 ─────────────────────────────────  │
│  [ 變更密碼 ]                                │
│                                              │
│  [ 取消 ]                          [ 儲存 ]  │
└──────────────────────────────────────────────┘
```
