function requiredEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required env var ${name}`)
  }
  return value.trim()
}

export const cognitoConfig = {
  domain: requiredEnv('VITE_COGNITO_DOMAIN').replace(/\/+$/, ''),
  clientId: requiredEnv('VITE_COGNITO_CLIENT_ID'),
  redirectUri: requiredEnv('VITE_COGNITO_REDIRECT_URI'),
  identityProvider: requiredEnv('VITE_COGNITO_IDENTITY_PROVIDER'),
  scopes: requiredEnv('VITE_COGNITO_SCOPES'),
}
