import { setAuthTokenProvider, setUnauthorizedHandler } from '@/shared/lib/api/client'
import { i18next } from '@/shared/i18n'
import { pushToast } from '@/shared/ui/toast/toastSink'

import { refreshAccessToken } from './refresh'
import { getAccessToken } from './tokenStorage'

setAuthTokenProvider(() => getAccessToken())

setUnauthorizedHandler(async () => {
  const token = await refreshAccessToken()
  if (!token) {
    // Refresh failed — the user is being force-logged-out by the interceptor
    // path, not by AuthProvider.logout(). Tell them why.
    pushToast({ tone: 'error', message: i18next.t('errors:token_not_valid') })
  }
  return token
})

export { AuthProvider } from './AuthProvider'
export { useAuth } from './useAuth'
export { RequireAuth } from './RequireAuth'
export { RequirePermission } from './RequirePermission'
export { RedirectPortalOnly } from './RedirectPortalOnly'
export { RedirectAuthenticated } from './RedirectAuthenticated'
export { Can } from './Can'
export { hasPermission } from './permissions'
export type { AuthUser, AuthContextValue } from './types'
