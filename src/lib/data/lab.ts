// Seed-backed getters for the internal /lab QA pages. They never touch Supabase, so an empty or
// half-seeded database can't break the production build (lab pages are noindex and dev-only tools).
import * as seed from './seed'
import type { Collection, Product } from '../types'

export async function getCollections(): Promise<Collection[]> { return seed.collections }
export async function getCollection(slug: string): Promise<Collection | null> { return seed.collections.find((c) => c.slug === slug) ?? null }
export async function getProducts(): Promise<Product[]> { return seed.products }
export async function getDropOfWeek(): Promise<Product | null> { return seed.products.find((p) => p.dropOfWeek) ?? null }
export async function getEvents() { return seed.events }
export async function getPartnerships() { return seed.partnerships }
export async function getSettings() { return seed.settings }
export async function getInstaPosts() { return seed.instaPosts }
export async function getCustomRules() { return seed.customRules }
export async function getHoodieTiers() { return seed.hoodieTiers }
export async function getTeeFits() { return seed.teeFits }
