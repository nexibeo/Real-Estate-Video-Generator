# Repository settings

Values for the GitHub **About** panel. Set them at
<https://github.com/nexibeo/Real-Estate-Video-Generator/settings>, or with the `gh` CLI below.

## Description

> Turn real estate listing photos into a narrated property tour video. Jev classifies each room,
> one cinematic shot per room, AI voiceover and captions — rendered in your browser.

*(238 characters; GitHub allows 350.)*

## Website

`https://videamax.com`

## Topics

```
real-estate  proptech  video-generation  ai-video  image-to-video
text-to-speech  openrouter  replicate  nextjs  typescript
stripe  canvas  mediarecorder  property-marketing  listing-photos
room-classification  client-side-rendering  jev
```

## Set both in one command

```bash
gh repo edit nexibeo/Real-Estate-Video-Generator \
  --description "Turn real estate listing photos into a narrated property tour video. Jev classifies each room, one cinematic shot per room, AI voiceover and captions — rendered in your browser." \
  --homepage "https://videamax.com" \
  --add-topic real-estate --add-topic proptech --add-topic video-generation \
  --add-topic ai-video --add-topic image-to-video --add-topic text-to-speech \
  --add-topic openrouter --add-topic replicate --add-topic nextjs \
  --add-topic typescript --add-topic stripe --add-topic canvas \
  --add-topic mediarecorder --add-topic property-marketing \
  --add-topic listing-photos --add-topic room-classification \
  --add-topic client-side-rendering --add-topic jev
```

> The description currently on the repo is the pre-build one taken from PROJECT.md §1. It is now
> inaccurate in two ways: there is no listing-URL scraping in the product, and there is no
> subscription — only credit packs.
