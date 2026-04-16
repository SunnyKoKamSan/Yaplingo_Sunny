#set document(
  title: "AI-Driven Pronunciation Learning Application",
  author: "CHAN, Yiu Cheung",
)

#set text(font: "Libertinus Serif", size: 12pt)

#include "cover.typ"

#set page(
  paper: "a4",
  header: [
    #set text(size: 10pt)
    CENG4999AD/CHC2503 – Final Year Project
    #h(1fr)
    Final Report
  ],
  footer: align(right, text(size: 10pt, context {
    counter(page).display()
  })),
)

#set par(spacing: 1em)
#set heading(numbering: "1.1.1.a.")

#show link: underline
#show heading: set block(spacing: 1.25em)
#show figure: set block(spacing: 1.25em)
#show <heading:unnumbered>: set heading(numbering: none, outlined: false)
#show <figure:listing>: set par(leading: 0.4em)

#counter(page).update(1)

#include "abstract.typ"
#include "acknowledgements.typ"

#outline(depth: 4)
#pagebreak()

#include "introduction.typ"
#include "development.typ"
#include "system-design.typ"
#include "implementation.typ"
#include "conclusion.typ"

#bibliography("bibliography.yml", style: "ieee", title: "References", full: true)
