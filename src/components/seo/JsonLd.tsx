// <JsonLd data={…} /> — server-rendered JSON-LD. Owner: F2.
// `data` may be one object, an array (rendered as one script each) or null (renders nothing).
import { serializeJsonLd } from '@/lib/seo'

type Data = Record<string, unknown>

export default function JsonLd({ data, id }: { data: Data | Array<Data | null> | null | undefined; id?: string }) {
  if (!data) return null
  const list = (Array.isArray(data) ? data : [data]).filter((d): d is Data => !!d)
  if (!list.length) return null
  return (
    <>
      {list.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          {...(id ? { id: list.length > 1 ? `${id}-${i}` : id } : {})}
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(d) }}
        />
      ))}
    </>
  )
}

export { JsonLd }
