// Bibliographic rules from Slides-Template's biblatex alphabetic configuration.
// Labels are supplied separately so citeproc's different trigraph defaults are unused.
export const bibliographyStyle = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0" default-locale="en-US">
  <info>
    <title>Virgiling alphabetic references</title>
    <id>https://virgiling.com/styles/alphabetic</id>
    <category citation-format="label"/>
    <updated>2026-01-01T00:00:00+00:00</updated>
  </info>
  <locale><style-options punctuation-in-quote="false"/></locale>
  <macro name="authors">
    <names variable="author"><name initialize-with=". " and="text" delimiter=", " delimiter-precedes-last="never"/><substitute><names variable="editor"/></substitute></names>
  </macro>
  <macro name="year"><date variable="issued"><date-part name="year"/></date></macro>
  <macro name="publisher"><group delimiter=", "><group delimiter=": "><text variable="publisher-place"/><text variable="publisher"/></group><text macro="year"/></group></macro>
  <macro name="pages"><group delimiter=" "><label variable="page" form="short"/><text variable="page"/></group></macro>
  <citation>
    <layout prefix="[" suffix="]" delimiter="; "><group delimiter=", "><text variable="citation-label"/><group delimiter=" "><label variable="locator" form="short"/><text variable="locator"/></group></group></layout>
  </citation>
  <bibliography et-al-min="4" et-al-use-first="3" entry-spacing="1">
    <layout suffix=".">
      <text variable="citation-label" prefix="[" suffix="]" display="left-margin"/>
      <group delimiter=". " display="right-inline">
        <text macro="authors"/>
        <choose><if type="book thesis report" match="any"><text variable="title" font-style="italic"/></if><else><text variable="title" quotes="true"/></else></choose>
        <choose>
          <if type="article-journal article-magazine article-newspaper" match="any">
            <group delimiter=", "><group delimiter=" "><text variable="container-title" font-style="italic" prefix="In: "/><group delimiter="."><text variable="volume"/><text variable="issue"/></group><text macro="year" prefix="(" suffix=")"/></group><text macro="pages"/></group>
          </if>
          <else-if type="paper-conference chapter" match="any">
            <group delimiter=". "><text variable="container-title" font-style="italic" prefix="In: "/><group delimiter=" "><label variable="volume" text-case="capitalize-first" form="short"/><text variable="volume"/></group><group delimiter=", "><text macro="publisher"/><text macro="pages"/></group></group>
          </else-if>
          <else>
            <group delimiter=". "><choose><if is-numeric="edition"><group delimiter=" "><number variable="edition" form="ordinal"/><text term="edition" form="short"/></group></if><else><text variable="edition"/></else></choose><text variable="genre"/><text macro="publisher"/></group>
          </else>
        </choose>
      </group>
    </layout>
  </bibliography>
</style>`;
