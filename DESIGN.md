---
name: Shady Notes Web
description: High-contrast white reading surfaces with yellow emphasis and black structure.
colors:
  accent: "#ffd60a"
  tint: "#fff3b0"
  tint-soft: "#fff9dc"
  paper: "#ffffff"
  ink: "#000000"
  ink-secondary: "#2b2b2d"
  muted: "#555555"
  hair: "rgb(0 0 0 / 22%)"
  disabled: "#eeeeee"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"SF Pro Text\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "clamp(44px, 5.8vw, 78px)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.025em"
  chapter:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"SF Pro Text\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "clamp(34px, 6vw, 46px)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"SF Pro Text\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"SF Pro Text\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"SF Pro Text\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  button:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"SF Pro Text\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  code:
    fontFamily: "ui-monospace, \"SF Mono\", Menlo, monospace"
    fontSize: "14.5px"
    fontWeight: 400
rounded:
  code: "5px"
  key: "6px"
  panel: "14px"
  pill: "999px"
spacing:
  inline: "8px"
  mobile-gutter: "16px"
  gutter: "24px"
  card: "32px"
  grid: "48px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  card-pricing:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "{spacing.card}"
  code-chip:
    backgroundColor: "{colors.tint-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.code}"
    padding: "2px 6px"
---

# Design System: Shady Notes Web

## Overview

**Creative North Star: "The High-Contrast Manual"**

White paper, black structure and yellow emphasis make the marketing site and documentation feel like one readable manual. This is the user-selected Dozer reference as implemented for Shady Notes: plain controls, framed product evidence and generous reading space. It replaces the earlier green terminal treatment on web surfaces.

This file governs this site (shady-notes/website) and the docs site (`docs-site/` in shadynotes-hostinger). Native macOS imagery, existing brand films and slide decks retain their own visual authority in the brand brief; their genuine colours are product evidence, not web chrome. The umbrella remains the actual artwork beside the two-word name.

**Key Characteristics:**
- White ground and black text, borders and focus rings.
- Yellow fills and pale yellow reading highlights.
- Sans reading and controls; mono code, paths and pricing data.
- Rounded framed panels and pill controls.
- Real app imagery, shared navigation and shared footer language.

## Colors

One yellow accent sits inside a black, white and grey reading system.

### Primary
- **Yellow Accent** (`accent`): primary actions, the slogan highlight, selected billing and text selection. Always black text on the yellow fill.
- **Yellow Tint** (`tint`): hero and CTA bands, selected chapter, table headers, warning surfaces and link hover.
- **Soft Yellow** (`tint-soft`): footer, inline code, code captions and reading callouts.

### Neutral
- **Paper** (`paper`): page, navigation, code and ordinary card backgrounds.
- **Ink** (`ink`): headings, body, rules, frames and focus rings.
- **Secondary Ink** (`ink-secondary`): summaries and figure captions.
- **Muted Ink** (`muted`): secondary copy and navigation.
- **Hairline** (`hair`): paragraph-section separators, table row divisions and contents rails; not reading text.
- **Disabled Grey** (`disabled`): unavailable buttons.

### Named Rules
**The Yellow Fill Rule.** Yellow is a fill or highlight with black text; reading links remain black and underlined.

**The Evidence Colour Rule.** Product screenshots, app theme samples and existing films keep their authentic colours; the surrounding web controls use the web palette.

## Typography

**Display and Body Font:** the platform sans stack recorded in frontmatter.
**Code and Data Font:** the system mono stack recorded in frontmatter.

The supplied reference deliberately uses installed system fonts. Body copy is generous and headings have tight tracking and balanced wrapping. Pricing values and technical paths retain mono; ordinary control labels use sans.

### Hierarchy
- **Display:** homepage slogan, bold with the observed fluid ramp and short measure (12ch desktop, 13ch mobile).
- **Chapter:** documentation h1, bold fluid size. Other marketing page h1s use 36px and 48px at the medium breakpoint.
- **Headline:** docs h2 uses the frontmatter role; marketing sections use 30px and 36px at the medium breakpoint.
- **Title:** docs h3; pricing titles use 20px bold.
- **Body:** documentation and base page reading use the recorded body role. Marketing copy also uses 16px, 18px and 20px according to prominence.
- **Code:** blocks use the recorded code size, falling to 13px at 600px in docs. Inline code is 0.88em in docs; labels and captions are typically 12–14px.

### Named Rules
**The Reading Measure Rule.** Docs article width is 70ch; summaries and prose excerpts stay within 60–65ch where their components establish that limit.

## Layout

Marketing uses a centred container (1152px), ordinary gutters (24px), large grid gaps (48px) and recurring section bands (96px vertical padding). The mobile homepage hero changes to 40px top, 48px bottom and a 36px gap. Mobile navigation uses 16px side gutters. Tailwind's medium breakpoint (768px) exposes desktop marketing navigation; large layouts (1024px) place product evidence beside copy.

Documentation keeps Starlight's responsive chapter navigation and on-page contents around a 70ch article. Sidebar width is 264px and header height is 65px. The custom header hides site links below 960px and the download action at 600px. The docs directory uses two columns with a 24px gap, collapsing at 600px. Wide tables and code scroll inside their own framed boxes. The footer uses four columns, then one below 768px.

## Elevation & Depth

The supplied reference explicitly selects crisp black frames and a hard lower edge for panels. This is a scoped reference choice rather than a general recommendation for other visual worlds. Primary and secondary buttons change fill on hover without lifting. Product imagery, code, pricing and pagination share the panel edge. The screenshot zoom uses a translucent white backdrop and a soft shadow to separate the image from the reading surface.

### Shadow Vocabulary
- **Reference panel edge** (`box-shadow: 0 4px 0 #000`): framed product evidence, code blocks, pricing, CTA panels and docs cards.
- **Zoom separation** (`box-shadow: 0 1.5rem 3rem rgb(0 0 0 / 0.45)`): enlarged docs screenshots only.

### Named Rules
**The State Before Lift Rule.** Buttons respond through colour and focus, without hover elevation.

Motion is purposeful: button colour transitions use 0.15s ease-out; the gesture demonstration uses a 1s `cubic-bezier(0.16, 1, 0.3, 1)` transform. Screenshot zoom scales from 0.98 over 0.15s ease-out. Reduced motion disables these animations. Existing films retain their playback controls and pause behavior.

## Shapes

Reading panels and product frames use gently rounded corners (14px), controls use pills (999px), inline code uses a small curve (5px), and keyboard keys use a small curve (6px) with a heavier bottom edge. Most structural lines are 1px black; the lighter hairline separates subordinate reading structure. The reference's blockquotes use a 4px black leading rule, which is native to its manual language.

## Components

### Buttons
Plain, compact pill controls with clear fill states. Primary is yellow, secondary white, ghost transparent and underlined. Shared buttons use 10px 20px padding and a minimum 44px height. Hover becomes black with white text; disabled controls use grey with muted ink. Shared site and docs focus is a 3px black outline with a 3px offset; existing component utilities can retain their narrower 2px treatment.

### Cards / Containers
Product frames, pricing cards, CTA panels and docs reading cards use black borders, rounded panel corners and the reference panel edge. Pricing cards use 32px padding; featured pricing uses Soft Yellow. Hoverable docs cards and pagination use Yellow Tint. Genuine screenshots remain ungraded and their captions stay outside the image.

### Code and Keyboard Keys
Inline code is black on Soft Yellow, padded 2px 6px. Code blocks use white, black framing and mono. Docs syntax remains monochrome; copy controls are pills. Keyboard keys are white with 1px black sides and a 2px bottom border.

### Reading Tables and Callouts
Tables use 15px text at 1.45 line-height, 12px 14px cell padding, yellow headers and internal horizontal overflow. First columns are sticky and bold. Callouts keep black titles and borders, using the yellow tints for tone; caution and danger use the stronger tint, so their labels also carry their meaning.

### Navigation
The marketing header is white with a black bottom border, genuine umbrella mark and sans wordmark. Current pages and hover links are underlined. The mobile menu is a native disclosure. Docs add search, chapter navigation and an on-page contents rail. Current chapters are bold on Yellow Tint with a 3px black inset bar; current contents entries use a 3px leading bar. Footer groups have small uppercase functional headings rather than labels above page titles.

### Gesture Stage and Screenshot Zoom
The retained gesture stage shows real product behavior inside a framed demonstration. Its internal app surface may preserve its native appearance. Docs screenshots open in a white-backed zoom surface with a caption; visibility uses `hidden`, and reduced motion stops the scale entrance.

## Do's and Don'ts

### Do:
- **Do** keep web reading surfaces white with black structure and yellow emphasis.
- **Do** use black text on yellow and keep reading links underlined.
- **Do** preserve actual app imagery and the real umbrella artwork.
- **Do** keep wide code and tables inside their own scroll boxes.
- **Do** retain visible focus and respect reduced motion.

### Don't:
- **Don't** reintroduce green glow, Matrix rain or dark web chrome from the replaced web system.
- **Don't** apply web colours to native app screenshots or existing authored films.
- **Don't** overlay text on the umbrella or redraw the artwork.
- **Don't** add decorative kickers above page or section headings.
- **Don't** treat the reference's system display face or hard panel edge as permission to reuse those devices in a different visual world.

Not canonized or repaired: stale Matrix-palette comments and superseded utility classes in shared buttons, residual mono billing labels, and the gesture stage's older soft-shadow treatment remain implementation drift. The system display face and hard panel edge are recorded only as the explicitly selected reference's scoped choices, not general own-world defaults. No source repairs were made in this documentation pass.
