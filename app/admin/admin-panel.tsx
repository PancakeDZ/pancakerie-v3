
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/browser'

const STATUT_ACTIF = 'active'
const STATUT_MASQUE = 'draft'

type Produit = {
  id: string
  name: string
  price: number
  compare_at_price: number | null
  status: string
}

type Variante = {
  id: string
  product_id: string
  name: string
  price: number
  is_active: boolean
}

type Zone = {
  id: string
  name: string
  fee: number
  min_order_amount: number | null
  is_active: boolean
}

type Photo = {
  id: string
  product_id: string
  storage_path: string
  alt_text: string | null
  is_primary: boolean
  sort_order: number
}

const nombre = (texte: string): number | null => {
  const n = Number(texte.replace(',', '.'))
  return texte.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null
}

export function BoutonDeconnexion() {
  const router = useRouter()

  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut()
        router.push('/admin/login')
        router.refresh()
      }}
      className="rounded-full bg-gray-900 px-4 py-1.5 text-xs font-bold text-white"
    >
      Se déconnecter
    </button>
  )
}

export default function AdminPanel(props: {
  produits: Produit[]
  variantes: Variante[]
  zones: Zone[]
  photos: Photo[]
}) {
  const supabase = createClient()
  const router = useRouter()

  const [message, setMessage] = useState('')
  const [fichiers, setFichiers] = useState<Record<string, File>>({})
  const [apercus, setApercus] = useState<Record<string, string>>({})
  const [uploadEnCours, setUploadEnCours] = useState<string | null>(null)

  const [prods, setProds] = useState(
    (props.produits ?? []).map((p) => ({
      ...p,
      prix: String(p.price),
      promo: p.compare_at_price == null ? '' : String(p.compare_at_price),
    }))
  )

  const [vars, setVars] = useState(
    (props.variantes ?? []).map((v) => ({
      ...v,
      prix: String(v.price),
    }))
  )

  const [lieux, setLieux] = useState(
    (props.zones ?? []).map((z) => ({
      ...z,
      frais: String(z.fee),
      minimum: z.min_order_amount == null ? '' : String(z.min_order_amount),
    }))
  )

  const sauver = async (
    table: 'products' | 'product_variants' | 'delivery_zones',
    id: string,
    valeurs: Record<string, unknown>,
    libelle: string
  ) => {
    const { data, error } = await supabase
      .from(table)
      .update(valeurs)
      .eq('id', id)
      .select('id')

    if (error) setMessage(`❌ ${libelle} : ${error.message}`)
    else if (!data || data.length === 0)
      setMessage(`❌ ${libelle} : non enregistré (droits insuffisants ?)`)
    else setMessage(`✅ ${libelle} enregistré`)
  }

  const choisirPhoto = (productId: string, fichier: File | undefined) => {
    if (!fichier) return

    if (!fichier.type.startsWith('image/')) {
      setMessage('❌ Merci de sélectionner une image.')
      return
    }

    if (fichier.size > 20 * 1024 * 1024) {
      setMessage('❌ La photo dépasse la limite de 20 Mo.')
      return
    }

    const ancienApercu = apercus[productId]
    if (ancienApercu) URL.revokeObjectURL(ancienApercu)

    setFichiers((courant) => ({
      ...courant,
      [productId]: fichier,
    }))

    setApercus((courant) => ({
      ...courant,
      [productId]: URL.createObjectURL(fichier),
    }))

    setMessage('')
  }

  const envoyerPhoto = async (produit: Produit) => {
    const fichier = fichiers[produit.id]

    if (!fichier) {
      setMessage('❌ Sélectionne d’abord une photo.')
      return
    }

    setUploadEnCours(produit.id)
    setMessage('Envoi de la photo en cours…')

    const nomFichier = fichier.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9.-]/g, '-')

    const chemin = `${produit.id}/${Date.now()}-${nomFichier}`

    const { error: erreurEnvoi } = await supabase.storage
      .from('product-images')
      .upload(chemin, fichier, {
        cacheControl: '3600',
        upsert: false,
        contentType: fichier.type,
      })

    if (erreurEnvoi) {
      setMessage(`❌ Envoi impossible : ${erreurEnvoi.message}`)
      setUploadEnCours(null)
      return
    }

    const { error: erreurAnciennePhoto } = await supabase
      .from('product_images')
      .update({ is_primary: false })
      .eq('product_id', produit.id)

    if (erreurAnciennePhoto) {
      await supabase.storage.from('product-images').remove([chemin])
      setMessage(`❌ Mise à jour impossible : ${erreurAnciennePhoto.message}`)
      setUploadEnCours(null)
      return
    }

    const { error: erreurEnregistrement } = await supabase
      .from('product_images')
      .insert({
        id: crypto.randomUUID(),
        product_id: produit.id,
        storage_path: chemin,
        alt_text: produit.name,
        is_primary: true,
        sort_order: 0,
        created_at: new Date().toISOString(),
      })

    if (erreurEnregistrement) {
      await supabase.storage.from('product-images').remove([chemin])
      setMessage(`❌ Enregistrement impossible : ${erreurEnregistrement.message}`)
      setUploadEnCours(null)
      return
    }

    const ancienApercu = apercus[produit.id]
    if (ancienApercu) URL.revokeObjectURL(ancienApercu)

    setFichiers((courant) => {
      const copie = { ...courant }
      delete copie[produit.id]
      return copie
    })

    setApercus((courant) => {
      const copie = { ...courant }
      delete copie[produit.id]
      return copie
    })

    setMessage(`✅ Photo de ${produit.name} enregistrée avec succès.`)
    setUploadEnCours(null)
    router.refresh()
  }

  const champ =
    'w-24 rounded border border-[#FECDD3] px-2 py-1 text-sm'

  const bouton =
    'rounded-full bg-[#EC4899] px-3 py-1 text-xs font-bold text-white hover:bg-[#BE185D]'

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6 text-[#831843]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Administration</h1>
        <BoutonDeconnexion />
      </div>

      {message && (
        <p className="sticky top-2 z-10 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white">
          {message}
        </p>
      )}

      <section>
        <h2 className="mb-2 text-lg font-black">Produits et photos</h2>

        <p className="mb-3 text-xs text-gray-500">
          Tu peux modifier les prix, les promotions, la visibilité et les photos
          de tes produits.
        </p>

        <div className="space-y-3">
          {prods.map((p, i) => {
            const photoPrincipale = props.photos.find(
              (photo) =>
                photo.product_id === p.id && photo.is_primary
            )

            const urlPhoto = photoPrincipale
              ? supabase.storage
                  .from('product-images')
                  .getPublicUrl(photoPrincipale.storage_path).data.publicUrl
              : null

            return (
              <div
                key={p.id}
                className="space-y-3 rounded-xl border border-[#FECDD3] bg-white p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-40 flex-1 text-sm font-bold">
                    {p.name}
                  </span>

                  <label className="text-xs">
                    Prix €{' '}
                    <input
                      className={champ}
                      value={p.prix}
                      onChange={(e) =>
                        setProds(
                          prods.map((x, j) =>
                            j === i ? { ...x, prix: e.target.value } : x
                          )
                        )
                      }
                    />
                  </label>

                  <label className="text-xs">
                    Prix barré €{' '}
                    <input
                      className={champ}
                      value={p.promo}
                      onChange={(e) =>
                        setProds(
                          prods.map((x, j) =>
                            j === i ? { ...x, promo: e.target.value } : x
                          )
                        )
                      }
                    />
                  </label>

                  <label className="text-xs">
                    <input
                      type="checkbox"
                      checked={p.status === STATUT_ACTIF}
                      onChange={(e) =>
                        setProds(
                          prods.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  status: e.target.checked
                                    ? STATUT_ACTIF
                                    : STATUT_MASQUE,
                                }
                              : x
                          )
                        )
                      }
                    />{' '}
                    Visible
                  </label>

                  <button
                    className={bouton}
                    onClick={() => {
                      const prix = nombre(p.prix)
                      const promo =
                        p.promo.trim() === '' ? null : nombre(p.promo)

                      if (
                        prix === null ||
                        (p.promo.trim() !== '' && promo === null)
                      ) {
                        setMessage('❌ Prix invalide')
                        return
                      }

                      sauver(
                        'products',
                        p.id,
                        {
                          price: prix,
                          compare_at_price: promo,
                          status: p.status,
                        },
                        p.name
                      )
                    }}
                  >
                    Enregistrer
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 border-t border-[#FECDD3] pt-3">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border bg-pink-50">
                    {apercus[p.id] ? (
                      <img
                        src={apercus[p.id]}
                        alt="Aperçu de la nouvelle photo"
                        className="h-full w-full object-cover"
                      />
                    ) : urlPhoto ? (
                      <img
                        src={urlPhoto}
                        alt={photoPrincipale?.alt_text || p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="px-2 text-center text-xs text-gray-500">
                        Aucune photo Supabase
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="block text-xs font-bold">
                      Choisir une nouvelle photo
                    </label>

                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadEnCours === p.id}
                      onChange={(e) =>
                        choisirPhoto(p.id, e.target.files?.[0])
                      }
                      className="block w-full text-xs"
                    />

                    <button
                      type="button"
                      disabled={!fichiers[p.id] || uploadEnCours === p.id}
                      onClick={() => envoyerPhoto(p)}
                      className="rounded-full bg-[#EC4899] px-4 py-2 text-xs font-bold text-white hover:bg-[#BE185D] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {uploadEnCours === p.id
                        ? 'Envoi en cours…'
                        : 'Envoyer la photo'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-black">Tailles (S / XL)</h2>

        <div className="space-y-2">
          {vars.map((v, i) => {
            const produit = props.produits.find(
              (p) => p.id === v.product_id
            )

            return (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-[#FECDD3] bg-white p-3"
              >
                <span className="min-w-40 flex-1 text-sm font-bold">
                  {produit?.name} — {v.name}
                </span>

                <label className="text-xs">
                  Prix €{' '}
                  <input
                    className={champ}
                    value={v.prix}
                    onChange={(e) =>
                      setVars(
                        vars.map((x, j) =>
                          j === i ? { ...x, prix: e.target.value } : x
                        )
                      )
                    }
                  />
                </label>

                <label className="text-xs">
                  <input
                    type="checkbox"
                    checked={v.is_active}
                    onChange={(e) =>
                      setVars(
                        vars.map((x, j) =>
                          j === i
                            ? { ...x, is_active: e.target.checked }
                            : x
                        )
                      )
                    }
                  />{' '}
                  Actif
                </label>

                <button
                  className={bouton}
                  onClick={() => {
                    const prix = nombre(v.prix)

                    if (prix === null) {
                      setMessage('❌ Prix invalide')
                      return
                    }

                    sauver(
                      'product_variants',
                      v.id,
                      { price: prix, is_active: v.is_active },
                      `${produit?.name} ${v.name}`
                    )
                  }}
                >
                  Enregistrer
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-black">Frais de livraison</h2>

        <div className="space-y-2">
          {lieux.map((z, i) => (
            <div
              key={z.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-[#FECDD3] bg-white p-3"
            >
              <span className="min-w-40 flex-1 text-sm font-bold">
                {z.name}
              </span>

              <label className="text-xs">
                Frais €{' '}
                <input
                  className={champ}
                  value={z.frais}
                  onChange={(e) =>
                    setLieux(
                      lieux.map((x, j) =>
                        j === i ? { ...x, frais: e.target.value } : x
                      )
                    )
                  }
                />
              </label>

              <label className="text-xs">
                Minimum €{' '}
                <input
                  className={champ}
                  value={z.minimum}
                  onChange={(e) =>
                    setLieux(
                      lieux.map((x, j) =>
                        j === i
                          ? { ...x, minimum: e.target.value }
                          : x
                      )
                    )
                  }
                />
              </label>

              <label className="text-xs">
                <input
                  type="checkbox"
                  checked={z.is_active}
                  onChange={(e) =>
                    setLieux(
                      lieux.map((x, j) =>
                        j === i
                          ? { ...x, is_active: e.target.checked }
                          : x
                      )
                    )
                  }
                />{' '}
                Active
              </label>

              <button
                className={bouton}
                onClick={() => {
                  const frais = nombre(z.frais)
                  const minimum =
                    z.minimum.trim() === '' ? null : nombre(z.minimum)

                  if (
                    frais === null ||
                    (z.minimum.trim() !== '' && minimum === null)
                  ) {
                    setMessage('❌ Montant invalide')
                    return
                  }

                  sauver(
                    'delivery_zones',
                    z.id,
                    {
                      fee: frais,
                      min_order_amount: minimum,
                      is_active: z.is_active,
                    },
                    z.name
                  )
                }}
              >
                Enregistrer
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
