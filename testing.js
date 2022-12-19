function niceTime(ms) {
    let s = Math.floor(ms / 1000)
    let ranges = ['s', 'min', 'hours']
    let rangeIndex = 0
    let result = []
    console.log(s)
    while (s > 0) {
        console.log(">>>", s)
        let diff = s - Math.floor(s / 60) * 60
        result.push(`${diff}${ranges[rangeIndex]}`)
      	console.log(diff)
        rangeIndex += 1
        s = (s - diff) / 60
        console.log("<<<", s)
      	if (rangeIndex == ranges.length) { break; }
    }
    return result.reverse().join(' ')
}

console.log(niceTime(1000 * 65 + 1000 * 60 * 60 * 2))