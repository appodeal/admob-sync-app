import {clipboard} from 'electron';
import React from 'react';


function toClipBoard (text) {
    clipboard.writeText(text);
    new Notification(`Copied to clipboard '${text}'`);
}

export const TextToClipboard = ({text}: { text: string }) => (<span onClick={() => toClipBoard(text)}>{text}</span>);
