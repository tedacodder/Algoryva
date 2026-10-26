import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { editorHtml } from "./editorPage";

describe("editor page", () => {
  it("loads the bundled editor from the same folder, and has a place for it", () => {
    const html = editorHtml("file:///data/python/");
    assert.match(html, /<script src="file:\/\/\/data\/python\/editor\.bundle\.js">/);
    assert.match(html, /<div id="editor">/);
  });
});
