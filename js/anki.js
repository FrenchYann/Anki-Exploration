const EASE_FACTOR = 2.5;
// global object that holds all parameters needed to run the simulation
// or do more things
// default parameter that aren't shared by optimizer and simulator 
// are defined here so they aren't undefined
window.simulation_parameters = {
  extra_sim:0,
  dead_point:0
}

Array.prototype.shuffle = function(){
  // While there are elements in the array
  for(let counter = this.length-1; counter > 0; counter--){
    // Pick a random index
    let index = Math.floor(Math.random() * (counter+1));

    // And swap the last element with it
    let temp = this[counter];
    this[counter] = this[index];
    this[index] = temp;

  }
};  

class Card {
  constructor(deck) {
    this.deck = deck;
    this.interval = 0; // last interval
    this.due = 0; // number of day before it's due
    this.ease_factor = EASE_FACTOR; // starts with default ease_factor 
  }
  update_due() {
    if (this.due > 0) this.due--;
  }
  is_due() {
    return this.due === 0;
  }
  pass() {
    this.interval = Math.round(this.interval * this.ease_factor * this.deck.interval_modifier);
    this.interval = Math.max(1, this.interval); // interval can't be lower than 1
    this.due = this.interval;
  }
  fail() {
    this.interval = Math.round(this.interval * window.simulation_parameters.failure_penalty);
    this.interval = Math.max(1, this.interval); // interval can't be lower than 1
    this.due = this.interval;
    if(window.simulation_parameters.use_anki_fail_factor) {
      this.ease_factor = Math.max(1.3, this.ease_factor-0.2);
    }
  }
}

class LogEntry {
  constructor(cards, reps, reviews, dead_count = 0, extra=false) {
    this.cards = cards;
    this.reps = reps;
    this.reviews = reviews; //number of due cards this day    
    this.dead_count = dead_count; // number of cards whose interval got over the dead point
    this.extra = extra; // log after end of sim
  }
}

class Deck {
  constructor(size, retention, interval_modifier, new_card_per_day) {
    this.retention = retention;
    this.interval_modifier = interval_modifier;
    this.new_card_per_day = new_card_per_day;
    this.new_cards = [];
    this.reviews = [];
    for (let i = 0; i < size; i++) {
      this.new_cards.push(new Card(this));
    }
    this.log=[];
  }
  update_day(extra = false) {
    let total_reps = 0;
    let today_reviews = [];
    for(let review of this.reviews) {
      review.update_due();
      if (review.is_due()) {
        today_reviews.push(review); // get all due cards today
      }
    }
    today_reviews.shuffle(); // randomize todays review
    let pass_count = Math.round(today_reviews.length * this.retention);
    let fail_count = today_reviews.length - pass_count;
    total_reps += pass_count + fail_count*window.simulation_parameters.reps_failed; 
    for(let i = 0; i < today_reviews.length; i++) {
      // pass and fail match retention
      let rev = today_reviews[i];
      if (i < pass_count) {
        rev.pass();
      } else {
        rev.fail();
      }
    }


    // get the new cards and graduate them
    let today_new = this.new_cards.splice(0, this.new_card_per_day);
    total_reps += today_new.length * window.simulation_parameters.reps_new;
    for(let new_card of today_new){
      new_card.pass();
      this.reviews.push(new_card);
    }
    // dead point handling
    let dead_count = 0;
    if (window.simulation_parameters.dead_point > 0) {
      for (let i = this.reviews.length-1; i>=0; i--) {
        if (this.reviews[i].interval >= window.simulation_parameters.dead_point) {
          this.reviews.splice(i, 1);
          dead_count++;
        }    
      }
    }
    
    this.log.push(new LogEntry(
      today_reviews.length + today_new.length,
      Math.round(total_reps),
      today_reviews.length,
      dead_count,
      extra
    ));

  }
  simulate() {
    while(this.new_cards.length > 0) {
      this.update_day();
    }
    for (let i = 0; i < window.simulation_parameters.extra_sim; i++) {
      this.update_day(true);
    }
  }
}

window.simulate = function(deck_size, retention, interval_modifier, new_cards_day) {
  // let start with just 100 cards
  let deck = new Deck(deck_size, retention,interval_modifier, 
                      new_cards_day);
  deck.simulate();
  return deck;
}
