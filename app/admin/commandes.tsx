
'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/browser'

type Commande = {
  id: string
  order_number: number
  customer_name: string
  customer_phone: string
  customer_email: string | null
  delivery_address: string | null
  delivery_city: string | null
  customer_notes: string | null
  status: string
  payment_method: string | null
  payment_status: string
  subtotal: number
  delivery_fee: number
  total: number
  created_at: string
}

type ArticleCommande = {
  id: string
  order_id: string
  product_name: string
  variant_name: string | null
  unit_price: number
  quantity: number
  line_total: number
}

const statuts = [
  ['pending', 'Nouvelle'],
  ['confirmed', 'Confirmée'],
  ['preparing', 'En préparation'],
  ['ready', 'Prête'],
  ['delivering', 'En livraison'],
  ['completed', 'Terminée'],
  ['cancelled', 'Annulée'],
]

const paiements = [
  ['unpaid', 'Non payé'],
  ['pending', 'En attente'],
  ['paid', 'Payé'],
  ['refunded', 'Remboursé'],
  ['failed', 'Échec'],
]

const euro = (montant: number) =>
  `${Number(montant).toFixed(2).replace('.', ',')} €`

export default function Commandes({
  commandes,
  articles,
}: {
  commandes: Commande[]
  articles: ArticleCommande[]
}) {
  const supabase = createClient()
  const [liste, setListe] = useState(commandes)
  const [message, setMessage] = useState('')
  const [selection, setSelection] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState<string | null>(null)

  const modifier = async (
    id: string,
    champ: 'status' | 'payment_status',
    valeur: string
  ) => {
    setEnregistrement(id)
    setMessage('')

    const { data, error } = await supabase
      .from('orders')
      .update({ [champ]: valeur })
      .eq('id', id)
      .select('id')

    if (error) {
      setMessage(`Erreur : ${error.message}`)
    } else if (!data || data.length === 0) {
      setMessage('Modification refusée : vérifie les droits administrateur.')
    } else {
      setListe((ancienne) =>
        ancienne.map((c) => (c.id === id ? { ...c, [champ]: valeur } : c))
      )
      setMessage('Modification enregistrée.')
    }

    setEnregistrement(null)
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-black">Commandes</h2>
        <p className="text-sm text-gray-500">
          {liste.length} commande(s) enregistrée(s)
        </p>
      </div>

      {message && (
        <p className="rounded-xl bg-pink-50 p-3 text-sm font-bold">
          {message}
        </p>
      )}

      {liste.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
          Aucune commande enregistrée pour le moment.
        </p>
      ) : (
        <div className="space-y-3">
          {liste.map((commande) => {
            const ouverte = selection === commande.id
            const sesArticles = articles.filter(
              (article) => article.order_id === commande.id
            )

            return (
              <article
                key={commande.id}
                className="overflow-hidden rounded-2xl border border-pink-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() =>
                    setSelection(ouverte ? null : commande.id)
                  }
                  className="w-full p-4 text-left"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-base">
                      Commande #{commande.order_number}
                    </strong>
                    <strong className="text-pink-700">
                      {euro(commande.total)}
                    </strong>
                  </div>
                  <p className="mt-1 text-sm font-semibold">
                    {commande.customer_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(commande.created_at).toLocaleString('fr-FR')}
                  </p>
                  <p className="mt-2 text-xs text-pink-700">
                    {ouverte ? 'Masquer le détail ▲' : 'Voir le détail ▼'}
                  </p>
                </button>

                {ouverte && (
                  <div className="space-y-4 border-t border-pink-100 p-4">
                    <div>
                      <h3 className="mb-2 font-bold">Coordonnées du client</h3>
                      <p className="text-sm">{commande.customer_name}</p>
                      <p className="text-sm">{commande.customer_phone}</p>
                      {commande.customer_email && (
                        <p className="text-sm">{commande.customer_email}</p>
                      )}
                      {commande.delivery_address && (
                        <p className="text-sm">
                          {commande.delivery_address}
                          {commande.delivery_city
                            ? `, ${commande.delivery_city}`
                            : ''}
                        </p>
                      )}
                      {commande.customer_notes && (
                        <p className="mt-2 text-sm text-gray-600">
                          Note : {commande.customer_notes}
                        </p>
                      )}
                    </div>

                    <div>
                      <h3 className="mb-2 font-bold">Articles commandés</h3>
                      {sesArticles.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          Aucun article associé à cette commande.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {sesArticles.map((article) => (
                            <div
                              key={article.id}
                              className="flex justify-between gap-3 text-sm"
                            >
                              <span>
                                {article.quantity} × {article.product_name}
                                {article.variant_name
                                  ? ` — ${article.variant_name}`
                                  : ''}
                              </span>
                              <strong>{euro(article.line_total)}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 border-t border-pink-100 pt-3 text-sm">
                      <p className="flex justify-between">
                        Sous-total <span>{euro(commande.subtotal)}</span>
                      </p>
                      <p className="flex justify-between">
                        Livraison <span>{euro(commande.delivery_fee)}</span>
                      </p>
                      <p className="flex justify-between text-base font-black">
                        Total <span>{euro(commande.total)}</span>
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-semibold">
                        Statut de la commande
                        <select
                          value={commande.status}
                          disabled={enregistrement === commande.id}
                          onChange={(e) =>
                            modifier(commande.id, 'status', e.target.value)
                          }
                          className="mt-1 w-full rounded-lg border p-2"
                        >
                          {statuts.map(([valeur, libelle]) => (
                            <option key={valeur} value={valeur}>
                              {libelle}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm font-semibold">
                        Paiement
                        <select
                          value={commande.payment_status}
                          disabled={enregistrement === commande.id}
                          onChange={(e) =>
                            modifier(
                              commande.id,
                              'payment_status',
                              e.target.value
                            )
                          }
                          className="mt-1 w-full rounded-lg border p-2"
                        >
                          {paiements.map(([valeur, libelle]) => (
                            <option key={valeur} value={valeur}>
                              {libelle}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {enregistrement === commande.id && (
                      <p className="text-xs text-gray-500">
                        Enregistrement en cours…
                      </p>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
