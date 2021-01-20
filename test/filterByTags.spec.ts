import 'mocha';
import { assert } from 'chai';
// import { filterByTags } from '../src/helper';

function filterByTags(testTagString: string, filterTagString: string) {
    // splits by whole word, or "quoted word"
    let testTags = (testTagString || '').replace(/,/g, ' ').match(/(~|@|\w)+/g) || [];
    let andTags = (filterTagString || '').replace(/,/g, ' ').match(/(~|@|\w)+|"[^"]+"/g) || [];
    return andTags.reduce((and, tag) => {
        const orTags = tag.replace(/\"/g, '').match(/\S+/g);
        const test = orTags.reduce((or, tag) => {
            const negate = tag.startsWith('~');
            const test = testTags.includes(tag.replace('~', ''));
            return or || (negate ? !test || testTags.length === 0 : test);
        }, false);
        return and && test;
    }, true);
}

describe('Filter scenarios by tags', () => {
    it("YES filterByTags('@main @ignore', '@ignore')  should be true", () => {
        const actual = filterByTags('@main @ignore', '@ignore');
        assert.equal(actual, true);
    });
    it("NOT filterByTags('@main @ignore', '~@ignore')  should be false", () => {
        const actual = filterByTags('@main @ignore', '~@ignore');
        assert.equal(actual, false);
    });
    it("OR filterByTags('@main @ignore', '\"@main,~@ignore\"')  should be true", () => {
        const actual = filterByTags('@main @ignore', '"@main,@ignore"');
        assert.equal(actual, true);
    });
    it("OR filterByTags('@main @ignore', '\"@main,@ignore,@other\"')  should be true", () => {
        const actual = filterByTags('@main @ignore', '"@main,@ignore,@other"');
        assert.equal(actual, true);
    });
    it("AND filterByTags('@main @ignore', '@main,@ignore,@other')  should be false", () => {
        const actual = filterByTags('@main @ignore', '@main,@ignore,@other');
        assert.equal(actual, false);
    });
    it("NOTHING filterByTags('@main @ignore', '')  should be true", () => {
        const actual = filterByTags('@main @ignore', '');
        assert.equal(actual, true);
    });
    it("NULL filterByTags('@main @ignore', '')  should be true", () => {
        const actual = filterByTags('@main @ignore', null);
        assert.equal(actual, true);
    });
    it("NOTHING filterByTags('', '')  should be true", () => {
        const actual = filterByTags('', '');
        assert.equal(actual, true);
    });
    it("NOTAGS filterByTags('', '@main')  should be false", () => {
        const actual = filterByTags('', '@main');
        assert.equal(actual, false);
    });
    it("NO NOTAGS filterByTags('', '~@main')  should be true", () => {
        const actual = filterByTags('', '~@main');
        assert.equal(actual, true);
    });
});
