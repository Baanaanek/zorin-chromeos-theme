export class GridLayout {
    constructor(params = {}) {
        this.columns = params.column_homogeneous ?? false;
        this.attached = [];
    }

    attach(child, column, row, columnSpan, rowSpan) {
        this.attached.push({child, column, row, columnSpan, rowSpan});
    }
}

export default {
    ActorAlign: {START: 'start', CENTER: 'center', END: 'end', FILL: 'fill'},
    GridLayout,
    EVENT_STOP: true,
    EVENT_PROPAGATE: false,
    KEY_Escape: 'Escape',
    KEY_Return: 'Return',
};
