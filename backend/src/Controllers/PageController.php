<?php
namespace App\Controllers;
use App\Core\Response;
class PageController {
    public function index(): void {
        Response::json([
            'byPerson' => [
                ['name'=>'R. Sharma','role'=>'Reporter','stories'=>42,'front'=>6,'exclusive'=>4,'avgSize'=>540],
                ['name'=>'M. Verma','role'=>'Reporter','stories'=>38,'front'=>3,'exclusive'=>7,'avgSize'=>610],
                ['name'=>'A. Khan','role'=>'Desk Editor','stories'=>51,'front'=>9,'exclusive'=>2,'avgSize'=>480],
                ['name'=>'P. Jain','role'=>'Page Editor','stories'=>29,'front'=>11,'exclusive'=>5,'avgSize'=>720],
            ],
            'epaper' => ['adRatio'=>38,'newsRatio'=>62,'colorPages'=>8,'layoutBalance'=>'Slightly ad-heavy on p.3'],
        ]);
    }
}
