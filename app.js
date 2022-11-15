nlp.extend(compromiseDates)

var app = Vue.createApp({
  data() {
    setTimeout(() => {
      const entries = JSON.parse(localStorage.getItem("journal-entries"))
      if (!entries) return
      
      Object.keys(entries).forEach(key => {
        const entry = entries[key]
        this.addEntry(new Date(entry.date), entry.text)
      })
    }, 20)

    return {
      search: {
        query: "",
        results: {
          total: 0,
          entries: 0,
          matchingEntries: {}
        }
      },
      journalUpload: "",
      entries: { }
    }
  },
  methods: {
    addEntry(date, text) {
      const entry = { date, text: text.trim() }
      // entry.lower = entry.text.toLowerCase()

      const doc = nlp(text)
      // console.log(date, text, doc.people().json())

      entry.doc = doc

      const dateStr = date.toISOString().slice(0, 10)
      const existingEntry = this.entries[dateStr]
      this.entries[dateStr] = entry


      localStorage.setItem("journal-entries", JSON.stringify(this.entries))
    },
    resize(event) {
      console.log(event)
      const el = event.target
      el.style.height = (el.scrollHeight + 4) + 'px'
    },
    entryHeight(key) {
      this.$nextTick(() => {
        const el = document.querySelector(`#entry-${key} > textarea`)
        el.style.height = (el.scrollHeight + 4) + 'px' 
      })

      return undefined
    },
    getEntry(date) {
      const dateStr = date.toISOString().slice(0, 10)
      return this.entries[dateStr]
    },
    scrollToEntry(key) {
      if (this.entries[key]) document.getElementById("entry-" + key).scrollIntoView()
    },
    entryIsMatch(key) {
      if (this.search.query != "") {
        return this.search.results.matchingEntries[key]
      }

      return false
    },
    dateLinkClasses(key) {
      if (!this.entries[key]) return ''
      if (this.search.query == "") return 'btn-primary'
      if (this.entryIsMatch(key)) return 'btn-primary'
      return 'btn-dark'
    }
  },
  watch: {
    async journalUpload(text) {
      if (text === "") return
      this.journalUpload = ""

      document.activeElement.blur()
      await new Promise(r => setTimeout(r, 100))

      const newEntries = []

      // console.log(text)
      const lines = text.split("\n")
      for (const line of lines) {
        const doc = nlp(line)
        const dates = doc.dates()
        // console.log(dates.json())
        // console.log(doc.people().json())
        
        const newEntry = {
          date: null, text: ""
        }

        // console.log(dates.json())

        const entryDate = dates.json()[0]
        if (entryDate && entryDate.terms.length > 1 && entryDate.dates.duration.days === 1 && line.startsWith(entryDate.text)) {
          const date = new Date(entryDate.dates.start)
          while (date > new Date()) {
            // console.log(entryDate)
            date.setUTCFullYear(date.getUTCFullYear() - 1)
          }

          newEntry.date = date
          newEntry.text = line.slice(entryDate.text.length)

          // console.log(entryDate)
        }

        const currentEntry = newEntries[newEntries.length - 1]

        if (newEntry.date) {
          if (currentEntry) {
            this.addEntry(currentEntry.date, currentEntry.text)

            await new Promise(r => setTimeout(r, 10))
          }

          newEntries.push(newEntry)
        } else if (currentEntry) {
          currentEntry.text += "\n" + line
        }
      }

      const currentEntry = newEntries[newEntries.length - 1]
      if (currentEntry) this.addEntry(currentEntry.date, currentEntry.text)
      
      // console.log(newEntries)

    },
    "search.query": debounce(function() {
      const { results } = this.search
      results.total = 0
      results.entries = 0

      const matchingEntries = results.matchingEntries = {}

      let { query } = this.search
      if (query == '') return
      
      if (query.startsWith('/')) {
        const end = query.lastIndexOf("/")
        query = new RegExp(query.slice(1, end), query.slice(end + 1))
      }
      
      Object.keys(this.entries).forEach(key => {
        const entry = this.entries[key]

        let count
        if (query instanceof RegExp || !query.startsWith('~')) {
          count = entry.text.split(query).length - 1
        } else {
          count = entry.doc.match(query.slice(1)).length
        }

        if (count > 0) {
          results.total += count
          results.entries += 1
          matchingEntries[key] = true
        }
      })
      
    }, 500)
  },
  computed: {
    sortedDates() {
      return Object.keys(this.entries).sort((a, b) => a < b)
    },
    scrollBarDates() {
      if (this.sortedDates.length < 1) return []

      const getDate = (key) => {
        const [y, m, d] = key.split("-")
        return new Date(y, m - 1, d)
      }
      
      const firstDate = getDate(this.sortedDates[0])
      const lastDate = getDate(this.sortedDates[this.sortedDates.length - 1])
      
      const list = [{
        date: firstDate,
        key: this.sortedDates[0]
      }]
      let currentDate = firstDate
      while (currentDate > lastDate) {
        currentDate = new Date(currentDate.getTime() - 86400000)
        list.push({
          date: currentDate,
          key: currentDate.toISOString().slice(0, 10)
        })
      }

      // console.log(list)
      return list
    }
  }
}).mount("#app")

function debounce(fn, delay) {
  var timeoutID = null
  return function () {
    clearTimeout(timeoutID)
    var args = arguments
    var that = this
    timeoutID = setTimeout(function () {
      fn.apply(that, args)
    }, delay)
  }
}