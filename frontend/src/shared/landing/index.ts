export { useLandingContent } from './useLandingContent'
export { resolveLanding } from './resolve'
export { landingKeys } from './landingKeys'
export {
  DEFAULT_ICON_KEY,
  isCtaTarget,
  isIconKey,
  landingIcon,
  LANDING_CTA_TARGETS,
  LANDING_ICON_KEYS,
} from './config'
export { isSocialPlatform, socialHref, SOCIAL_PLATFORMS } from './social'
export type { SocialPlatform } from './social'
export { LandingIcon } from './LandingIcon'
export { LandingSocialIcon } from './LandingSocialIcon'
export { HeroImage } from './HeroImage'
export {
  LandingCtaBand,
  LandingFeatures,
  LandingFooter,
  LandingHero,
} from './sections/LandingSections'
export { LandingSocialRow } from './sections/LandingSocialRow'
export type {
  LandingContent,
  LandingHighlight,
  LandingSocialLink,
  ResolvedHighlight,
  ResolvedLanding,
  ResolvedSocialLink,
} from './types'
// `fetchLandingContent` is deliberately NOT re-exported — nothing outside
// this module calls it, the same restraint `shared/branding/index.ts` shows.
