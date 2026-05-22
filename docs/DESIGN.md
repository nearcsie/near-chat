---
name: Border UI
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
---

## Brand & Style

This design system is built on the principles of **structural minimalism** and **high-fidelity utility**. It moves away from the trend of soft shadows and organic shapes, instead favoring a rigid, architectural approach to interface design. The aesthetic is defined by a strict adherence to 1px linework, creating a "blueprint" feel that prioritizes information density and clarity.

The target audience is users who value precision, focus, and a distraction-free communication environment. By eliminating depth cues like shadows and gradients, the system relies entirely on stroke, color contrast, and negative space to communicate hierarchy. The emotional response is one of efficiency, technical sophistication, and reliability.

## Colors

The palette is restricted to a monochromatic core with a singular high-energy accent. 

- **Pure Monochromes:** #000000 and #FFFFFF are used for surfaces and primary borders to ensure maximum contrast. 
- **The Greyscale:** Intermediate greys are used exclusively for secondary text and structural lines that should not draw immediate attention.
- **Electric Blue:** #007AFF serves as the "action" signal. It is the only color used to denote interactivity, focus states, and primary calls to action.

In Dark Mode, the logic inverts: pure black becomes the canvas, and pure white becomes the structural skeleton. There are no middle-ground "dark grey" backgrounds for primary containers; they remain pure black to maintain the high-contrast, line-based aesthetic.

## Typography

This design system utilizes **Inter** for all UI elements to maintain a neutral, systematic appearance. For code snippets or technical metadata within the chat, a monospaced font is introduced.

- **Weight as Hierarchy:** Since shadows and colors are limited, font weight (SemiBold vs. Regular) is the primary tool for distinguishing between UI labels and user content.
- **Micro-Copy:** All-caps labels with slight letter-spacing are used for section headers and non-interactive metadata to provide a "technical ledger" aesthetic.
- **Readability:** Body text maintains a generous 1.5x line height to balance the density of the 1px border containers.

## Layout & Spacing

The layout is governed by a **fixed-stroke grid**. Instead of using gutters to separate content, containers are often butted directly against one another, separated by a single 1px shared border.

- **Grid System:** A fluid 12-column grid is used for the main application shell, while the chat interface uses a fixed-width sidebar (280px) and a flexible message thread.
- **Whitespace:** Despite the "tight" look of the lines, internal padding is generous (24px for main containers) to prevent the UI from feeling cramped. 
- **The 4px Rule:** All spacing increments must be multiples of 4px to ensure perfect alignment with the 1px stroke weight and the typography's baseline.

## Elevation & Depth

This system intentionally rejects Z-axis elevation. There are no shadows to indicate "lift."

- **Stacking Logic:** Depth is conveyed through **Z-index layering and stroke visibility**. An active modal or dropdown does not cast a shadow; it is simply a white (or black) box with a 1px border that sits on top of the underlying content.
- **The "Active" Offset:** To simulate a "pressed" state without shadows, elements may shift 1px down and 1px right, or simply change their border color to the primary accent (#007AFF).
- **Dimming:** When a modal is active, the background is not blurred. It is covered by a 50% opacity solid fill of the opposite theme color (e.g., a white overlay in dark mode).

## Shapes

The geometry of this design system is strictly **rectilinear**. 

- **Corners:** A universal 4px radius (`rounded-sm`) is applied to all components (buttons, input fields, chat bubbles). This is just enough to soften the industrial edge without losing the professional, structural feel.
- **Containers:** Main application panels and sidebar sections use 0px (sharp) corners where they meet the edge of the browser window, maintaining the "blueprint" look.
- **Interactivity Indicators:** Small square pips (4x4px) are used instead of circular dots for status indicators (e.g., online/offline).

## Components

### Buttons
- **Primary:** Solid #007AFF background, white text, 4px radius. No border.
- **Secondary:** Transparent background, 1px border (#000000 in light, #FFFFFF in dark), 4px radius.
- **Ghost:** No border, no background. Primary accent text. Text underlines only on hover.

### Input Fields
- **Default:** 1px border (#D1D1D6), 4px radius, white background.
- **Focus:** 1px border #007AFF. No "glow" or outer shadow.
- **Message Bar:** A fixed 1px border top that spans the width of the chat area, creating a dedicated horizontal zone.

### Chat Bubbles
- Unlike traditional rounded bubbles, these are rectangular boxes with a 1px border. 
- **Incoming:** White background, 1px black border.
- **Outgoing:** Very light grey (#F2F2F7) background or #007AFF for high emphasis.

### Lists & Navigation
- List items are separated by 1px horizontal lines. 
- Active states are indicated by a 4px vertical bar of #007AFF on the far left or right of the list item, rather than a full background change.

### Chips/Tags
- Rectangular with 4px radius. 1px border, 12px label-caps typography.
