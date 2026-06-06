<?php
namespace App\Controllers;
use App\Core\Response;
class ProductionController {
    public function index(): void {
        $heat = [];
        foreach (['City','Sports','Front','Biz','Edit'] as $d) {
            $heat[] = ['dept'=>$d,'values'=>array_map(function(){ return rand(0,50); }, range(1,7))];
        }
        Response::json([
            'stages' => [
                ['stage'=>'Page Open','target'=>'20:00','actual'=>'20:10','status'=>'ok'],
                ['stage'=>'Editing Done','target'=>'22:30','actual'=>'22:55','status'=>'warn'],
                ['stage'=>'PDF Export','target'=>'23:15','actual'=>'23:40','status'=>'warn'],
                ['stage'=>'Plate Release','target'=>'23:45','actual'=>'00:30','status'=>'late'],
                ['stage'=>'Printing','target'=>'00:30','actual'=>'01:05','status'=>'late'],
            ],
            'heatmap' => $heat,
            'prediction' => ['risk'=>'High','message'=>'Plate release likely to breach SLA by ~35 min based on last 14 days.'],
        ]);
    }
}
