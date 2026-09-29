// Edit these lists to change the phrases shown for each Lucky in a spin.
// One phrase is chosen at random from the matching numbered list.
export const LUCKY_CALLOUTS = [
  ["LUCKY DUCKY!", "A LUCKY!", "OH? HOW LUCKY!"],
  ["DOUBLE TROUBLE!", "TWO LUCKIES!", "GETTING SERIOUS!", "TAKES TWO TO TANGO!"],
  ["JACKPOT INBOUND!", "THREE'S THE CHARM!", "BIG BONUS INCOMING!", "THREESOME TO BE SUMN!"],
  ["I'LL TAKE THAT!", "SUPER LUCKY!", "FOUR OF A KIND!", "FOUR WAY, HAPPY DAY!"],
  ["ABSOLUTE BUFFOONERY!", "OH MY GOOD GOLLY GUMDROPS!", "THE STARS ALIGNED!"],
] as const;

export function getLuckyCallout(luckyNumber: number, random = Math.random) {
  const list = LUCKY_CALLOUTS[Math.min(Math.max(luckyNumber, 1), LUCKY_CALLOUTS.length) - 1];
  return list[Math.floor(random() * list.length)];
}
