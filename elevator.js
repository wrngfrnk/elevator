{
    init: function(elevators, floors) {
        const numElevators = Object.keys(elevators).length;
        const topFloor = floors.length - 1;
        const dirs = ['up', 'down'];

        elevators.forEach(elevator => {
            elevator.on("floor_button_pressed", floorNum => {
                if(!elevator.destinationQueue.includes(floorNum)){
                    elevator.goToFloor(floorNum);
                }
            });

            elevator.on("passing_floor", (floorNum, dir) => {
                if(elevator.destinationQueue.includes(floorNum)) {
                    elevator.destinationQueue = elevator.destinationQueue.filter(destFloor => {
                        return destFloor != floorNum; // Remove that floor from the queue to prevent unnecessesarily visiting it again
                    });

                    elevator.checkDestinationQueue(); // Update queue

                    // Stop at the floor if it's on the way to the destination floor (true = first in queue)
                    // otherwise wait until the elevator comes back (false = last in queue)
                    elevator.goToFloor(floorNum, elevator.destinationDirection() == dir);
                }
            });

            elevator.on("stopped_at_floor", floorNum => {
                let goUp, goDown;

                if(floorNum === topFloor || floorNum === 0) {
                    // it can obviously only go one way if it's at the top or bottom
                    goUp = floorNum < topFloor;
                    goDown = floorNum > 0;
                } else if(elevator.destinationQueue.length > 0 && numElevators > 1){ // Lights don't seem to work great with only one elevator...
                    // Indicate direction to next destination
                    goUp = elevator.destinationQueue[0] > floorNum;
                    goDown = !goUp;
                } else {
                    // No destionation, just go wherever!
                    goUp = true;
                    goDown = true;
                }
                
                elevator.goingUpIndicator(goUp);
                elevator.goingDownIndicator(goDown);
            });
        });

        floors.forEach(floor => {
            dirs.forEach(dir => { // if we need to do something depending on direction the person wants to go.
                floor.on(dir + "_button_pressed", () => {
                    let sortedElevators = elevators.sort((a, b) => {
                        // Decide suitability "score" of the elevators (more is better)
                        // TODO: Include something to better determine if it's going in the right direction, distance to floor, etc...
                        // As it is now it gets very messy, very fast.
                        return (
                            (b.maxPassengerCount() - (b.maxPassengerCount() * b.loadFactor())) -
                            (a.maxPassengerCount() - (a.maxPassengerCount() * a.loadFactor()))
                        );
                    });

                    
                    sortedElevators[0].goToFloor(floor.floorNum());
                });
            });
        });
    },
    update: function(dt, elevators, floors) {
        
    }
}