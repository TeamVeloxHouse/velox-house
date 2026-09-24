/* OpenAI image generation — turns a real Street View photo into a photoreal "solar panels
 * installed" render, via the gpt-image-1 images/edits endpoint (image-to-image, prompt-guided).
 * This is a REAL, PAID call (roughly $0.02–$0.19 per image depending on size/quality) — only
 * used when OPENAI_API_KEY is set; callers fall back to the free composite overlay otherwise.
 * Note: gpt-image-1 requires the OpenAI org to be verified (platform.openai.com → Settings →
 * Organization → Verify) — without that, edits requests 403 even with a valid key, and the
 * caller falls back the same as if no key were set. */

const PROMPT = `Add a modern residential solar panel array to the sloped roof of the house shown in this street-level photo.
Use black monocrystalline panels, laid out in a clean, evenly-spaced rectangular grid that follows the roof's true pitch,
perspective and vanishing lines exactly as an installer would fit them. Match the existing photo's lighting, shadow
direction and camera angle precisely so the panels look physically installed, not overlaid. Do not alter the house
structure, brickwork, windows, garden, sky, vehicles or anything else in the frame — change only the roof surface by
adding the panels. Photorealistic, high detail, no text, no watermark, no logo.`

export async function aiSolarMockup(imageBuf, contentType, key, opts = {}) {
  const form = new FormData()
  form.append('model', 'gpt-image-1')
  form.append('image', new Blob([imageBuf], { type: contentType || 'image/jpeg' }), 'house.jpg')
  form.append('prompt', opts.prompt || PROMPT)
  form.append('size', opts.size || '1024x1024')
  form.append('n', '1')

  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(`openai images/edits ${r.status}: ${j?.error?.message || 'unknown error'}`)
  const b64 = j?.data?.[0]?.b64_json
  if (!b64) throw new Error('openai images/edits: no image returned')
  return Buffer.from(b64, 'base64')
}
