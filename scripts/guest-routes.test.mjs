import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
for (const [route, title, destination] of [
  ['wine', 'Wine List', '/wine.html'],
  ['whiskey', 'Whiskey List', '/whiskey.html']
]) {
  test(route + ' preserves the existing menu and provides a manual fallback', () => {
    const page = read(route + '/index.html')
    assert.ok(page.includes('<title>' + title + '</title>'))
    assert.ok(page.includes('content="0; url=' + destination + '"'))
    assert.ok(page.includes('href="' + destination + '"'))
    assert.ok(read(destination.slice(1)).includes('<title>' + title + '</title>'))
  })
}
test('beverages links to all three guest menu destinations', () => {
  const page = read('beverages/index.html')
  assert.match(page, /<h1[^>]*>Beverages<\/h1>/)
  for (const suffix of ['wine.html', 'whiskey.html', 'liqueur/']) assert.ok(page.includes(suffix))
  assert.match(page, /Other Beverages/i)
})
test('other beverages clearly states that the list is still in development', () => {
  const page = read('liqueur/index.html')
  assert.match(page, /still in development/i)
  assert.match(page, /ask your server/i)
})
