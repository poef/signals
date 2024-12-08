import {signal, batch, effect, clockEffect } from '../src/signals.mjs'

export class Cell {
	constructor(alive, clock) {
		this.state = signal({
			alive: !!alive,
			neighbours: []
		})
		this.clock = clock
		clockEffect(() => {
			let neighbourCount = this.state.neighbours
				.filter(nb => nb.state.alive || nb.state.manual)
				.length
			if (this.state.manual || this.state.alive) {
				this.state.next = neighbourCount == 2 || neighbourCount == 3
			} else {
				this.state.next = neighbourCount == 3
			}
		}, clock)
		clockEffect(() => {
			let next = this.state.next
			let manual = this.state.manual
			this.state.alive = typeof manual != 'undefined' ? manual : next
			window.setTimeout(() => {
				delete this.state.manual // in a timeout, so that a change is registered for the next clock tick
			}, 10);
		}, clock)
	}
	
	setNeighbours(neighbours) {
		this.state.neighbours = neighbours
	}

	render(x,y) {
		let td = document.createElement('td')
		let checkbox = document.createElement('input')
		checkbox.type = 'checkbox'
		checkbox.addEventListener('click', evt => {
			this.state.manual = !!checkbox.checked
		})
		td.appendChild(checkbox)
		checkbox.dataset.x=x
		checkbox.dataset.y=y
		effect(() => {
			let checked = this.state.alive ? 'checked' : ''
			checkbox.checked = checked
		})
		effect(() => {
			let td = checkbox.closest('td')
			td.classList.remove('willLive')
			td.classList.remove('willDie')
			td.classList.remove('manual')
			if (this.state.manual) {
				td.classList.add('manual')
			} else if (this.state.next) {
				td.classList.add('willLive')
			} else if (this.state.alive) {
				td.classList.add('willDie')
			}
		})
		return td
	}
}

export class Board {
	constructor(boardSize, clock) {
		this.clock = clock
		this.size = boardSize
		this.rows = []
		for (let y=0; y<this.size[1]; y++) {
			let row = []
			for (let x=0; x<this.size[0]; x++) {
				row[x] = new Cell(false, clock)
			}
			this.rows[y] = row
		}
		const offsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
		for (let y=0; y<this.size[1];y++) {
			for (let x=0; x<this.size[0];x++) {
				let neighbours = offsets
					.map(([dx,dy]) => this.rows[y+dy]?.[x+dx])
					.filter(Boolean)
				this.rows[y][x].setNeighbours(neighbours)
			}
		}
	}

	render() {
		let table = document.createElement('table')
		let y = 0
		for (let row of this.rows) {
			let tr = document.createElement('tr')
			let x = 0
			for (let cell of row) {
				tr.append(cell.render(x,y))
				x++
			}
			table.appendChild(tr)
			y++
		}
		return table
	}

}
