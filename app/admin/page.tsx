
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import AdminPanel, { BoutonDeconnexion } from './admin-panel'
import Commandes from './commandes'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/admin/login')

  const { data: estAdmin } = await supabase.rpc('is_admin')

  if (!estAdmin) {
    return (
      <main className="mx-auto mt-24 max-w-sm rounded-3xl border bg-white p-6 text-center">
        <p className="mb-4 font-bold">
          Accès refusé : ce compte n&apos;est pas administrateur.
        </p>
        <BoutonDeconnexion />
      </main>
    )
  }

  // Chargement des produits, variantes, zones, photos et commandes
  const [
    produits,
    variantes,
    zones,
    photos,
    commandesResult,
  ] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, price, compare_at_price, status, sort_order')
      .order('sort_order'),

    supabase
      .from('product_variants')
      .select('id, product_id, name, price, is_active, sort_order')
      .order('sort_order'),

    supabase
      .from('delivery_zones')
      .select('id, name, fee, min_order_amount, is_active')
      .order('fee')
      .order('name'),

    supabase
      .from('product_images')
      .select('id, product_id, storage_path, alt_text, is_primary, sort_order')
      .order('sort_order'),

    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  // Récupération des articles associés aux commandes
  const idsCommandes = (commandesResult.data ?? []).map(
    (commande) => commande.id
  )

  const articlesResult =
    idsCommandes.length > 0
      ? await supabase
          .from('order_items')
          .select('*')
          .in('order_id', idsCommandes)
      : { data: [], error: null }

  console.log(
    'DIAGNOSTIC ADMIN',
    JSON.stringify({
      estAdmin,
      produitsErreur: produits.error?.message ?? null,
      variantesErreur: variantes.error?.message ?? null,
      zonesErreur: zones.error?.message ?? null,
      photosErreur: photos.error?.message ?? null,
      commandesErreur: commandesResult.error?.message ?? null,
      articlesErreur: articlesResult.error?.message ?? null,
      nombreCommandes: commandesResult.data?.length ?? 0,
      nombreArticles: articlesResult.data?.length ?? 0,
      nombrePhotos: photos.data?.length ?? 0,
    })
  )

  return (
    <>
      <AdminPanel
        produits={produits.data ?? []}
        variantes={variantes.data ?? []}
        zones={zones.data ?? []}
        photos={photos.data ?? []}
      />

      <main className="mx-auto max-w-7xl px-4 py-8">
        {commandesResult.error || articlesResult.error ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Impossible de charger les commandes. Vérifie les autorisations
            Supabase et les erreurs dans le terminal.
          </p>
        ) : (
          <Commandes
            commandes={commandesResult.data ?? []}
            articles={articlesResult.data ?? []}
          />
        )}
      </main>
    </>
  )
}
