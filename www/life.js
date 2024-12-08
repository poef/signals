import {signal, batch, effect, clockEffect } from '../src/signals.mjs'

export class Cell {
	constructor(alive, renderClock, calcClock, x, y) {
		this.state = signal({
			alive: !!alive,
			neighbours: []
		})
		this.x = x
		this.y = y
		clockEffect(() => {
			console.log('recalculate',x,y,this.state.alive,this.state.next)
			let neighbourCount = this.state.neighbours
				.filter(nb => nb.state.alive)
				.length
			if (this.state.alive) {
				this.state.next = neighbourCount == 2 || neighbourCount == 3
			} else {
				this.state.next = neighbourCount == 3
			}
			console.log('result',x,y,this.state.alive,this.state.next)
		}, calcClock)
		clockEffect(() => {
			console.log('render',x,y,this.state.alive,this.state.next)
			this.state.alive = this.state.next
			console.log('render result',x,y,this.state.alive,this.state.next)
		}, renderClock)
	}
	
	setNeighbours(neighbours) {
		this.state.neighbours = neighbours
	}

	render(x,y) {
		let td = document.createElement('td')
		let checkbox = document.createElement('input')
		checkbox.type = 'checkbox'
		checkbox.addEventListener('click', evt => {
			this.state.alive = !!checkbox.checked
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
			if (this.state.next) {
				td.classList.add('willLive')
			} else if (this.state.alive) {
				td.classList.add('willDie')
			}
		})
		return td
	}
}

export class Board {
	constructor(boardSize, renderClock, calcClock) {
		this.size = boardSize
		this.rows = []
		for (let y=0; y<this.size[1]; y++) {
			let row = []
			for (let x=0; x<this.size[0]; x++) {
				row[x] = new Cell(false, renderClock, calcClock, x, y)
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
