import { base } from 'astro:config/client'
export const baseUrl = base.replace(/\/$/, '')
