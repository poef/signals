# simply databinding with signals

goals:
x implement data-simply-field and data-simply-list - single data-bind for now
+ use view per app inside container element, not a global variable
X use rendering per html element type
+ use template for list items - single root entity per template
+ if a list item changes, only re-render that item, not the entire list
+ if a list item is removed, only remove that dom element
  without dom diffing
+ if a list item is added, only render that item

# game of life

+ create two board states of 10x10 - previous and current
+ render board of 10x10 cells
+ connect each cell to a clockEffect in the board
+ add button to increase the clock.time
- add play/pause button to increase the clock.time with setInterval
+ make it work :(

# clock
- tie effects to the clock
- add listeners to the clock object when detecting changes
- on clock.tick() only update the listeners that have been added since last tick
  empty listeners list on the clock before calling them

