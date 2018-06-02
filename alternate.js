{
    init: function(elevators, floors) {
        // Constants
        const numElevators = Object.keys(elevators).length,
              directions = ['up', 'down'],
              topFloor = floors.length - 1;

        // Object to handle requests
        var requests = {
            up: Array(floors.length).fill(false),
            down: Array(floors.length).fill(false),
            any: () => {
                return requests.up.map((v, i) => {
                    return requests.up[i] || requests.down[i];
                });
            },
            unrequest: (floor, dir = 'both') => {
                if(dir == 'both') {
                    requests.up[floor] = false;
                    requests.down[floor] = false;
                } else {
                    requests[dir][floor] = false;
                }
            }
        }

        elevators.forEach(elevator => {
            // Initialise on floor 0. Needed to kickstart the elevator at some points
            elevator.goingDownIndicator(false);

            // These functions return true if an elevator has destinations above / below.
            elevator.hasDestinationsAbove = (floor = elevator.currentFloor()) => {
                let floorIndex = requests.any().indexOf(true, floor + 1);
                let pressedAbove = elevator.destinationQueue.some((destFloor) => {
                    return destFloor > floor;
                });
                return (floorIndex > -1 && floorIndex > floor);
            }

            elevator.hasDestinationsBelow = (floor = elevator.currentFloor()) => {
                let floorIndex = requests.any().indexOf(true);
                let pressedBelow = elevator.destinationQueue.some((destFloor) => {
                    return destFloor < floor;
                });
                return (floorIndex > -1 && floorIndex < floor);
            }

            // Gets next floor to go to in direction.
            // Returns the floor number, or -1 if none are found.
            // TODO: There's some redundancy here and stopped_at_floor, sort that out.
            elevator.getNextDestination = (fromFloor, direction) => {
                let nextDestination = -1;

                if(direction == 'up' && elevator.hasDestinationsAbove(fromFloor)) {
                    nextDestination = requests.any().indexOf(true, fromFloor + 1);
                } else if(direction == 'down' && elevator.hasDestinationsBelow(fromFloor)) {
                    nextDestination = requests.any().slice(0, fromFloor).lastIndexOf(true, fromFloor);
                }

                return nextDestination;
            }

            // Gets the last (topmost, bottom-most) requested floor in direction
            // Returns the floor number, or -1 if none are found.
            // TODO: Unused, delete this?
            elevator.getLastDestination = (direction) => {
                let lastDestination = -1;
            
                if(direction == 'up') {
                    lastDestination = requests.any().lastIndexOf(true);
                } else if(direction == 'down') {
                    lastDestination = requests.any().indexOf(true);
                }

                return lastDestination;                
            }

            // Sends the elevator to selected floor (helper for goToFloor)
            // TODO: unrequest the targeted floor to prevent several elevators from going to the same floor
            elevator.sendTo = (floor, first = false) => {
                elevator.checkDestinationQueue();
                
                if(!elevator.destinationQueue.includes(floor)){
                    elevator.goToFloor(floor, first);
                }
            }

            // Whenever we stop at a floor, check whether to continue in that direction, then go there.
            elevator.on("stopped_at_floor", floorNum => {
                elevator.stop();
                let next,
                    goUp = true,
                    goDown = true,
                    nextDirection;

                // Perform a bunch of checks to determine next direction, in order of priority.
                // TODO: Probably optimise this, add more checks as needed...
                if(floorNum == topFloor) {
                    nextDirection = 'down';
                } else if(floorNum == 0) {
                    nextDirection = 'up';
                } else if(elevator.goingUpIndicator() && elevator.hasDestinationsAbove()) {
                    nextDirection = 'up';
                } else if(elevator.goingDownIndicator() && elevator.hasDestinationsBelow()) {
                    nextDirection = 'down';                 
                } else if(elevator.goingUpIndicator() && !elevator.hasDestinationsAbove()) {
                    nextDirection = 'down';
                } else if(elevator.goingDownIndicator() && !elevator.hasDestinationsBelow()) {
                    nextDirection = 'up';
                } else {
                    nextDirection = 'up'; // default to up
                }

                // Next destination determined! Set the lights and off we go.
                goUp = nextDirection == 'up';
                goDown = !goUp;

                elevator.goingUpIndicator(goUp);
                elevator.goingDownIndicator(goDown);
               
                // Unrequest this floor and assume we can unrequest this floor.
                requests.unrequest(floorNum, nextDirection);
                next = elevator.getNextDestination(floorNum, nextDirection);
                
                elevator.sendTo(next, true);

                /* console.log(
                    "next destination:", nextDirection, 
                    "to floor", next
                ); */
            });

            // Whenever we pass a floor, go there if there's a request in the same direction.
            elevator.on("passing_floor", (floorNum, direction) => {
                let otherDir = direction == 'up' ? 'down' : 'up';
                
                elevator.destinationQueue = elevator.destinationQueue.filter(floor => {
                    return floor !== floorNum;
                });

                if(requests[direction][floorNum] || elevator.getPressedFloors().includes(floorNum)) {
                    // If someone wants to go to / from here, let's stop.
                    elevator.sendTo(floorNum, true);
                } else if(requests[otherDir][floorNum]) {
                    // If there's a request in the other direction, go there on the way back.
                    // TODO: Send the most suitable elevator instead of always this one.
                    elevator.sendTo(floorNum);
                }
            });

            elevator.on("floor_button_pressed", pressedFloor => {
                elevator.sendTo(pressedFloor, true);
            });

            // When the elevator is idle, check every 100ms if there's any requests in either direction.
            elevator.on("idle", () => {
                var next = -1;
                
                let checkInterval = setInterval(() => {
                    if(elevator.hasDestinationsAbove()) {
                        next = elevator.getLastDestination('up');
                    } else if(elevator.hasDestinationsBelow()) {
                        next = elevator.getLastDestination('down');
                    }

                    if(next > -1) {
                        clearInterval(checkInterval);
                    }
                }, 100);

                elevator.sendTo(next, true);
            });
        });

        // Mark requests when the up/down button is pressed.
        floors.forEach(floor => {
            directions.forEach(direction => {
                floor.on(direction + "_button_pressed", () => {
                    requests[direction][floor.floorNum()] = true;
                    /* console.log(
                        "Requests:",
                        "up:", requests.up,
                        "down:", requests.down
                    ); */
                });
            });
        });
    },
    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}
