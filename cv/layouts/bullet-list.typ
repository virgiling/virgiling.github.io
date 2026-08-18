#let icon-path(value) = {
  let value = str(value)
  if value.contains("github") {
    return "../assets/github.svg"
  } else {
    return "../assets/website.svg"
  }
}


#let badge(body) = box(
  fill: rgb("#f0f3f6"),
  inset: (x: 4pt, y: 0pt),
  outset: (y: 2pt),
  radius: 2pt,
  baseline: -60%,
  text(size: 7.5pt, fill: rgb("#24292f"), style: "italic", body),
)

#let layout-bullet-list(data, isbreakable: true) = {
  // Set width for the bullet column
  let bullet-width = 2em

  block(width: 100%, breakable: isbreakable)[
    // Check if data is an array
    #if type(data) == array {
      for (index, item) in data.enumerate() {
        let title = item.title
        let target = item.link
        let desc = item.desc
        let status = if item.status == "" { "Archived" } else { item.status }
        // Create a grid with two columns
        grid(
          columns: (bullet-width, 1fr),
          gutter: 1em,

          // Bullet point in the first column
          align(right)[•],

          // List item text with markup in the second column
          box(link(target)[
            #box(width: .8em, baseline: .12em)[
              #image(icon-path(target), width: .8em)
            ]
            #strong(eval(title, mode: "markup")) #badge(status)
            #v(-.5em)
            #eval(desc, mode: "markup")
          ]),
        )

        // Add spacing between entries
        if index < data.len() - 1 {
          v(0.1em)
        }
      }
    } else {
      [No items found]
    }
  ]
}
